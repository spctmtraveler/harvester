(function () {
  if (window.HWDoneModal) return;

  const STYLE_ID = "hwie-done-modal-style";
  const ROOT_ID = "hwie-done-modal-root";

  let previousActive = null;

  function ensureStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = [
      ".hwie-done-modal-open{overflow:hidden;}",
      ".hwie-done-modal-backdrop{position:fixed;inset:0;display:none;align-items:center;justify-content:center;padding:24px;background:rgba(10,14,20,.68);backdrop-filter:blur(6px);z-index:9999;}",
      ".hwie-done-modal-backdrop.open{display:flex;}",
      ".hwie-done-modal-card{width:min(520px,calc(100vw - 32px));background:linear-gradient(180deg,#ffe370 0%,#ffd84a 100%);color:#2c2200;border:1px solid rgba(120,88,0,.34);border-radius:18px;box-shadow:0 24px 70px rgba(0,0,0,.45);padding:22px 22px 18px;position:relative;}",
      ".hwie-done-modal-eyebrow{font:700 11px/1.2 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;letter-spacing:.12em;text-transform:uppercase;color:rgba(76,56,0,.88);margin:0 0 10px;}",
      ".hwie-done-modal-title{margin:0 32px 8px 0;font:800 30px/1.05 'Segoe UI',system-ui,sans-serif;color:#1c1500;}",
      ".hwie-done-modal-message{margin:0 0 12px;font:600 15px/1.45 'Segoe UI',system-ui,sans-serif;color:#332700;}",
      ".hwie-done-modal-next{margin:0;padding-top:10px;border-top:1px solid rgba(120,88,0,.22);font:500 12px/1.5 'Segoe UI',system-ui,sans-serif;color:rgba(60,45,0,.92);}",
      ".hwie-done-modal-close-x{position:absolute;top:12px;right:12px;width:34px;height:34px;border:none;border-radius:999px;background:rgba(255,255,255,.38);color:#3d2e00;font:700 18px/1 'Segoe UI',system-ui,sans-serif;cursor:pointer;}",
      ".hwie-done-modal-close-x:hover,.hwie-done-modal-close-x:focus-visible,.hwie-done-modal-button:hover,.hwie-done-modal-button:focus-visible{outline:none;background:rgba(255,255,255,.58);}",
      ".hwie-done-modal-actions{display:flex;justify-content:flex-end;margin-top:16px;}",
      ".hwie-done-modal-button{border:none;border-radius:999px;padding:10px 16px;background:rgba(255,255,255,.46);color:#2d2200;font:700 13px/1 'Segoe UI',system-ui,sans-serif;cursor:pointer;}",
      "@media (max-width:560px){.hwie-done-modal-card{padding:18px 18px 16px;}.hwie-done-modal-title{font-size:26px;}}"
    ].join("");
    document.head.appendChild(style);
  }

  function closeModal() {
    const root = document.getElementById(ROOT_ID);
    if (!root) return;
    root.classList.remove("open");
    document.body.classList.remove("hwie-done-modal-open");
    if (previousActive && typeof previousActive.focus === "function") {
      previousActive.focus();
    }
    previousActive = null;
  }

  function ensureRoot() {
    let root = document.getElementById(ROOT_ID);
    if (root) return root;

    root = document.createElement("div");
    root.id = ROOT_ID;
    root.className = "hwie-done-modal-backdrop";
    root.innerHTML = [
      '<div class="hwie-done-modal-card" role="dialog" aria-modal="true" aria-labelledby="hwie-done-modal-title">',
      '  <button type="button" class="hwie-done-modal-close-x" aria-label="Close">×</button>',
      '  <div class="hwie-done-modal-eyebrow">Finished</div>',
      '  <h2 class="hwie-done-modal-title" id="hwie-done-modal-title">Finished</h2>',
      '  <p class="hwie-done-modal-message" id="hwie-done-modal-message"></p>',
      '  <p class="hwie-done-modal-next" id="hwie-done-modal-next"></p>',
      '  <div class="hwie-done-modal-actions">',
      '    <button type="button" class="hwie-done-modal-button">Close</button>',
      '  </div>',
      '</div>'
    ].join("");

    root.addEventListener("click", (event) => {
      if (event.target === root) closeModal();
    });
    root.querySelector(".hwie-done-modal-close-x").addEventListener("click", closeModal);
    root.querySelector(".hwie-done-modal-button").addEventListener("click", closeModal);

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") closeModal();
    });

    document.body.appendChild(root);
    return root;
  }

  function show(options) {
    ensureStyle();
    const root = ensureRoot();
    const title = root.querySelector("#hwie-done-modal-title");
    const message = root.querySelector("#hwie-done-modal-message");
    const next = root.querySelector("#hwie-done-modal-next");
    const primaryButton = root.querySelector(".hwie-done-modal-button");

    previousActive = document.activeElement && typeof document.activeElement.focus === "function"
      ? document.activeElement
      : null;

    title.textContent = String(options?.title || "Finished");
    message.textContent = String(options?.message || "This step finished successfully.");
    next.textContent = String(options?.nextSteps || "You can close this and continue when you are ready.");
    primaryButton.textContent = String(options?.buttonLabel || "Close");

    root.classList.add("open");
    document.body.classList.add("hwie-done-modal-open");
    root.querySelector(".hwie-done-modal-button").focus();
  }

  window.HWDoneModal = {
    show,
    close: closeModal
  };
})();