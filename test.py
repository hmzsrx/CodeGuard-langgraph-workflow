"""
Utility to read a local file referenced in an AgentState.

The function validates the provided path, checks that the file exists,
is a regular file, is readable, and does not exceed a 1 GB size limit.
It returns a dictionary containing the file path and its contents
as a UTF‑8 string, or an error_message describing any problem.

Returned dictionary keys:
    - file_path: absolute path to the file (str)
    - original_code: file contents as UTF‑8 text (str)
    - language: empty string (placeholder for downstream processing)
    - error_message: empty if successful, otherwise a description of the error
"""

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
# Ensure debug messages are emitted when the library user does not override.
logger.setLevel(logging.DEBUG)

# --------------------------------------------------------------------------- #
# Configuration
# --------------------------------------------------------------------------- #
# Maximum allowed file size: 1 GB (configurable via environment variable)
try:
    MAX_FILE_SIZE = int(os.getenv("MAX_FILE_SIZE", 1024 * 1024 * 1024))
except (ValueError, TypeError):
    logger.warning(
        "Invalid MAX_FILE_SIZE environment variable; falling back to 1 GB."
    )
    MAX_FILE_SIZE = 1024 * 1024 * 1024

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
    """
    Helper to obtain the file_path from either a dict‑like object or an
    AgentState instance.
    """
    if isinstance(state, dict):
        return state.get("file_path", "").strip()
    # Assume a custom object with a ``file_path`` attribute
    return getattr(state, "file_path", "").strip()


def _has_symlink(path: Path) -> bool:
    """
    Detect if *any* component of the given path (including the leaf) is a
    symbolic link. This prevents traversal through symlinks that could escape
    the allowed root.
    """
    current = Path(path.root) if path.is_absolute() else Path()
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
    """Return a uniform error dictionary."""
    return {
        "file_path": "",
        "original_code": "",
        "language": "",
        "error_message": message,
    }


def read_local_file(state: Any) -> Dict[str, Any]:
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
    raw_path = Path(expanded).expanduser()

    # Early existence check for clearer error messages.
    if not raw_path.exists():
        logger.error("Path does not exist: %s", raw_path)
        return _error_result("The specified path does not exist.")

    # Reject any symlink in any component of the path.
    if _has_symlink(raw_path):
        logger.warning("Symlink detected in path and rejected: %s", raw_path)
        return _error_result("Symlinks are not allowed.")

    # Resolve the path strictly – the file must exist.
    try:
        path = raw_path.resolve(strict=True)
    except FileNotFoundError:
        logger.error("File does not exist after resolution: %s", raw_path)
        return _error_result("The specified file does not exist.")
    except Exception as exc:
        logger.exception("Failed to resolve the provided path.")
        return _error_result(f"Invalid file path: {exc}")

    # Ensure the resolved path is inside the allowed directory.
    if not _is_within_allowed_root(path):
        logger.warning("Attempted access outside allowed root: %s", path)
        return _error_result("Access to the requested path is not allowed.")

    if not path.is_file():
        return _error_result("The provided path is not a regular file.")

    try:
        file_size = path.stat().st_size
        if file_size > MAX_FILE_SIZE:
            logger.error(
                "File exceeds size limit (%d bytes): %s", file_size, path
            )
            return _error_result("File exceeds the allowed size limit.")
    except OSError as exc:
        logger.exception("Unable to obtain file size for %s", path)
        return _error_result("Could not determine file size.")

    # Open the file safely and re‑validate after opening to mitigate TOCTOU.
    try:
        with path.open("r", encoding="utf-8") as f:
            # Re‑validate while the file descriptor is open.
            if not path.is_file() or not _is_within_allowed_root(path):
                logger.error("File changed during access: %s", path)
                return _error_result("File changed during access.")
            # Re‑check size after opening (using the file descriptor).
            fd = f.fileno()
            try:
                fd_stat = os.fstat(fd)
                if fd_stat.st_size > MAX_FILE_SIZE:
                    logger.error(
                        "File grew beyond size limit after opening: %d bytes",
                        fd_stat.st_size,
                    )
                    return _error_result("File exceeds the allowed size limit.")
            except OSError as exc:
                logger.exception("Failed to fstat opened file descriptor.")
                return _error_result("Could not verify file size after opening.")
            code = f.read()
    except UnicodeError:
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
