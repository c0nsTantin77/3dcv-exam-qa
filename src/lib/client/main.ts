// Client entry, loaded once per page (Astro bundles this module script). Each
// init guards on the elements it needs, so it is safe to run on every page.
import { initQuizzes } from "./quiz";
import { initStudy } from "./study";
import { initOpenAnswer } from "./open-answer";
import { initMode } from "./mode";
import { initChapterUI } from "./chapter-ui";
import { initProgress } from "./progress";
import { initShare } from "./share";
import { initHomeView, initFeedbackLink } from "./home";
import { initReviewIO } from "./review-io";
import { initCloud } from "./cloud";
import { runMigrations } from "./migrate";
import { APP_CONFIG } from "../config";

// migrate study data off de-duplicated question ids before anything reads it
runMigrations();

// per-question interactions (chapter pages)
initMode();
initQuizzes();
initOpenAnswer();
initStudy();

// chapter-page chrome (filter / expand / back-to-top / deep-link / contents pill)
initChapterUI();

// homepage chrome
initHomeView();
initFeedbackLink();

// works on any page that has a .share-pill
initShare();

// review-page export / import buttons
initReviewIO();

// progress dashboard + rings + sidebar bars (fetches the search index)
void initProgress();

// cloud sync + presence (only if Firebase is configured)
if (APP_CONFIG.firebase && APP_CONFIG.firebase.apiKey) {
  initCloud(APP_CONFIG.firebase);
}
