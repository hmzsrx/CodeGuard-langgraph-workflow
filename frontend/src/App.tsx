import { useState } from "react";
import { Sidebar, type PageName } from "./components/layout/Sidebar";
import { Topbar } from "./components/layout/Topbar";
import { Dashboard } from "./pages/Dashboard";
import { NewReview } from "./pages/NewReview";
import { History } from "./pages/History";
import { ReviewDetails } from "./pages/ReviewDetails";
import { Settings } from "./pages/Settings";
import { useCodeReview } from "./hooks/useCodeReview";

export default function App() {
  const [page, setPage] = useState<PageName>("dashboard");
  const [selectedHistoryId, setSelectedHistoryId] = useState<string | null>(null);
  const review = useCodeReview();

  function navigate(nextPage: PageName) {
    if (nextPage === "new-review") review.clearCurrent();
    setPage(nextPage);
    if (nextPage !== "details") setSelectedHistoryId(null);
  }

  function openReview(id: string) {
    setSelectedHistoryId(id);
    setPage("details");
  }

  function startNew() {
    review.clearCurrent();
    setPage("new-review");
  }

  return (
    <div className="app-shell">
      <Sidebar page={page} onNavigate={navigate} activeReview={review.current} />
      <div className="main-shell">
        <Topbar page={page} />
        <main className="main-content">
          {page === "dashboard" && (
            <Dashboard history={review.history} onNavigate={navigate} onOpenReview={openReview} />
          )}
          {page === "new-review" && (
            <NewReview
              review={review.current}
              busy={review.busy}
              error={review.requestError}
              onStart={review.startReview}
              onDecide={review.decide}
              onNew={() => {
                review.clearRequestError();
                navigate("new-review");
              }}
            />
          )}
          {page === "history" && <History history={review.history} onOpen={openReview} />}
          {page === "details" && (
            <ReviewDetails
              item={selectedHistoryId ? review.selectHistory(selectedHistoryId) : null}
              activeReview={review.current}
              busy={review.busy}
              error={review.requestError}
              onBack={() => navigate("history")}
              onDecide={review.decide}
              onNew={startNew}
            />
          )}
          {page === "settings" && <Settings />}
        </main>
        <footer className="app-footer"><span>CodeGuard AI</span><span>Review with confidence. Ship with care.</span></footer>
      </div>
    </div>
  );
}
