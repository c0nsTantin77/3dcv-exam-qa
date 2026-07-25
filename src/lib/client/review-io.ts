import { Store } from "./store";

// Export / import the progress blob. The buttons live in the review-page
// topbar; the ReviewPage island refreshes itself via the store's onChange.

export function initReviewIO(): void {
  const exp = document.getElementById("exportBtn");
  if (exp) {
    exp.addEventListener("click", () => {
      const blob = new Blob([Store.exportBlob()], { type: "application/json" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "3dcv-progress.json";
      a.click();
      URL.revokeObjectURL(a.href);
    });
  }

  const imp = document.getElementById("importFile") as HTMLInputElement | null;
  if (imp) {
    imp.addEventListener("change", () => {
      const f = imp.files?.[0];
      if (!f) return;
      const r = new FileReader();
      r.onload = () => {
        try {
          Store.importBlob(String(r.result));
          alert("Progress imported.");
        } catch {
          alert("Invalid file.");
        }
      };
      r.readAsText(f);
    });
  }

  // Reset all progress — guarded by an acknowledgement checkbox AND a 5s countdown.
  const resetBtn = document.getElementById("resetBtn");
  const dlg = document.getElementById("resetDlg") as HTMLDialogElement | null;
  if (resetBtn && dlg && typeof dlg.showModal === "function") {
    const ack = dlg.querySelector<HTMLInputElement>("#resetAck")!;
    const confirm = dlg.querySelector<HTMLButtonElement>("#resetConfirm")!;
    const cancel = dlg.querySelector<HTMLButtonElement>("#resetCancel")!;
    let timer: ReturnType<typeof setInterval> | null = null;
    let countdownDone = false;
    const stop = () => {
      if (timer) clearInterval(timer);
      timer = null;
    };
    const refresh = () => {
      confirm.disabled = !(countdownDone && ack.checked);
    };

    resetBtn.addEventListener("click", () => {
      ack.checked = false;
      countdownDone = false;
      confirm.disabled = true;
      let left = 5;
      confirm.textContent = `Confirm reset (${left})`;
      stop();
      timer = setInterval(() => {
        left -= 1;
        if (left > 0) {
          confirm.textContent = `Confirm reset (${left})`;
        } else {
          confirm.textContent = "Confirm reset";
          countdownDone = true;
          stop();
          refresh();
        }
      }, 1000);
      dlg.showModal();
    });
    ack.addEventListener("change", refresh);
    cancel.addEventListener("click", () => {
      stop();
      dlg.close();
    });
    confirm.addEventListener("click", () => {
      if (confirm.disabled) return;
      Store.reset();
      stop();
      dlg.close();
    });
  }
}
