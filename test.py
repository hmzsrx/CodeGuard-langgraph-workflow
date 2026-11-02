import logging
import os
from pathlib import Path
from typing import Any, Dict, Protocol, Union

# --------------------------------------------------------------------------- #
# Logging configuration
# --------------------------------------------------------------------------- #

logger = logging.getLogger(__name__)
if not logger.hasHandlers():
    handler = logging.StreamHandler()
    formatter = logging.Formatter(
        "%(asctime)s - %(name)s - %(levelname)s - %(message)s"
    )
    handler.setFormatter(formatter)
    logger.addHandler(handler)

# Set logger level based on an optional environment variable; default to INFO.
log_level_name = os.getenv("LOG_LEVEL", "INFO").upper()
_valid_levels = {
    "CRITICAL": logging.CRITICAL,
    "ERROR": logging.ERROR,
    "WARNING": logging.WARNING,
    "INFO": logging.INFO,
    "DEBUG": logging.DEBUG,
    "NOTSET": logging.NOTSET,
}
log_level = _valid_levels.get(log_level_name, logging.INFO)
if log_level_name not in _valid_levels:
    logger.warning(
        "Invalid LOG_LEVEL '%s' – falling back to INFO.", log_level_name
    )
logger.setLevel(log_level)

# --------------------------------------------------------------------------- #
# Configuration
# --------------------------------------------------------------------------- #

# Maximum allowed file size: 1 GB (configurable via environment variable)
# Clamp to a hard upper bound of 10 GB to avoid unreasonable limits.
_MAX_DEFAULT = 1024 * 1024 * 1024  # 1 GB
_MAX_HARD_LIMIT = 10 * 1024 * 1024 * 1024  # 10 GB
try:
    MAX_FILE_SIZE = int(os.getenv("MAX_FILE_SIZE", _MAX_DEFAULT))
    if MAX_FILE_SIZE > _MAX_HARD_LIMIT:
        logger.warning(
            "MAX_FILE_SIZE exceeds hard limit; capping to %d bytes.", _MAX_HARD_LIMIT
        )
        MAX_FILE_SIZE = _MAX_HARD_LIMIT
    elif MAX_FILE_SIZE <= 0:
        logger.warning(
            "MAX_FILE_SIZE must be positive; falling back to default %d bytes.",
            _MAX_DEFAULT,
        )
        MAX_FILE_SIZE = _MAX_DEFAULT
except (ValueError, TypeError, OverflowError):
    logger.warning(
        "Invalid MAX_FILE_SIZE environment variable; falling back to 1 GB."
    )
    MAX_FILE_SIZE = _MAX_DEFAULT

# Base directory that files are allowed to be read from.
# Can be overridden with the ALLOWED_ROOT environment variable.
ALLOWED_ROOT = Path(os.getenv("ALLOWED_ROOT", Path.cwd())).resolve()

def _is_within_allowed_root(path: Path) -> bool:
    """Return True if *path* is inside ALLOWED_ROOT after resolution.

    Handles case‑insensitivity on Windows by normalising both paths.
    """
    try:
        # Python 3.9+ provides Path.is_relative_to
        return path.is_relative_to(ALLOWED_ROOT)
    except AttributeError:
        # Fallback for older Python versions and Windows case‑insensitivity
        resolved_path = path.resolve()
        root = ALLOWED_ROOT
        if os.name == "nt":
            resolved_path = Path(os.path.normcase(str(resolved_path)))
            root = Path(os.path.normcase(str(root)))
        try:
            common = os.path.commonpath([str(root), str(resolved_path)])
            return common == str(root)
        except Exception:  # pragma: no cover
            return False


class HasFilePath(Protocol):
    """Protocol for objects that expose a ``file_path`` attribute."""
    file_path: str


def _extract_file_path(state: Union[dict, HasFilePath, Any]) -> str:
    """Helper to obtain the file_path from either a dict‑like object or an
    object that follows the ``HasFilePath`` protocol.

    Returns an empty string if the key/attribute is missing.
    """
    if isinstance(state, dict):
        return str(state.get("file_path", "")).strip()
    # Assume a custom object with a ``file_path`` attribute
    return str(getattr(state, "file_path", "")).strip()


def _has_symlink(path: Path) -> bool:
    """
    Detect if *any* component of the given path (including the leaf) is a
    symbolic link. This prevents traversal through symlinks that could escape
    the allowed root.
    """
    # Start from the anchor (e.g., "C:\\") to avoid duplicating drive letters.
    current = Path(path.anchor) if path.is_absolute() else Path()
    for part in path.parts:
        current = current / part
        try:
            if current.is_symlink():
                return True
        except OSError as exc:
            # Treat any error accessing the component as unsafe.
            logger.warning(
                "Unable to stat path component %s while checking for symlinks: %s",
                current,
                exc,
            )
            return True
    return False


def _error_result(message: str) -> Dict[str, Any]:
    """Return a uniform error dictionary.

    Keys:
        - file_path: empty string
        - original_code: empty string
        - language: empty string
        - error_message: provided message
    """
    return {
        "file_path": "",
        "original_code": "",
        "language": "",
        "error_message": message,
    }


def read_local_file(state: Union[dict, HasFilePath, Any]) -> Dict[str, Any]:
    """
    Read a local file specified in the AgentState or a compatible dict.

    Returns a dictionary with the following keys:
        - file_path: absolute path to the file (str)
        - original_code: file contents as UTF‑8 text (str)
        - language: empty string (placeholder for downstream processing)
        - error_message: empty if successful, otherwise a description of the error
    """
    file_path = _extract_file_path(state)

    if not isinstance(file_path, str) or not file_path:
        logger.error("No valid file_path provided in the state.")
        return _error_result("Please provide a local file path.")

    # Expand environment variables and user home.
    expanded = os.path.expandvars(file_path)
    # Basic sanity check on length to avoid OSError: [Errno 36] File name too long
    if len(expanded) > 4096:
        logger.error("Expanded file path is excessively long.")
        return _error_result("File path is too long.")

    raw_path = Path(expanded).expanduser()

    # Resolve the path strictly – the file must exist.
    try:
        path = raw_path.resolve(strict=True)
    except FileNotFoundError:
        logger.error("Path does not exist after resolution: %s", raw_path)
        return _error_result("The specified path does not exist.")
    except Exception as exc:
        logger.exception("Failed to resolve the provided path.")
        return _error_result(f"Invalid file path: {exc}")

    # Reject any symlink in any component of the path.
    if _has_symlink(path):
        logger.warning("Symlink detected in path and rejected: %s", path)
        return _error_result("Symlinks are not allowed.")

    # Ensure the resolved path is inside the allowed directory.
    if not _is_within_allowed_root(path):
        logger.warning("Attempted access outside allowed root: %s", path)
        return _error_result("Access to the requested path is not allowed.")

    if not path.is_file():
        return _error_result("The provided path is not a regular file.")

    try:
        file_stat = path.stat()
        if file_stat.st_size > MAX_FILE_SIZE:
            logger.error(
                "File exceeds size limit (%d bytes): %s", file_stat.st_size, path
            )
            return _error_result("File exceeds the allowed size limit.")
    except OSError as exc:
        logger.exception("Unable to obtain file size for %s", path)
        return _error_result("Could not determine file size.")

    # Open the file safely and re‑validate after opening to mitigate TOCTOU.
    try:
        # Use os.open with O_NOFOLLOW to avoid following symlinks at open time.
        fd = os.open(str(path), os.O_RDONLY | getattr(os, "O_NOFOLLOW", 0))
        with os.fdopen(fd, "r", encoding="utf-8") as f:
            # Verify that the file we opened matches the original inode/device.
            opened_stat = os.fstat(fd)
            if (
                opened_stat.st_ino != file_stat.st_ino
                or opened_stat.st_dev != file_stat.st_dev
            ):
                logger.error("File changed during access (inode/device mismatch): %s", path)
                return _error_result("File changed during access.")

            # Re‑check size after opening (using the file descriptor).
            if opened_stat.st_size > MAX_FILE_SIZE:
                logger.error(
                    "File grew beyond size limit after opening: %d bytes",
                    opened_stat.st_size,
                )
                return _error_result("File exceeds the allowed size limit.")

            try:
                code = f.read()
            except UnicodeDecodeError:
                logger.exception("UTF-8 decoding failed for file: %s", path)
                return _error_result("File could not be decoded as UTF‑8 text.")
    except PermissionError:
        logger.exception("Permission error while reading file: %s", path)
        return _error_result("Read permission denied for the file.")
    except OSError as exc:
        logger.exception("OS error while reading file: %s", path)
        return _error_result(f"Could not read file: {exc}")

    logger.debug("Successfully read file: %s", path)
    return {
        "file_path": str(path),
        "original_code": code,
        "language": "",  # Reserved for downstream language detection
        "error_message": "",
    }
