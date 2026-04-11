// =======================================
// 🔔 TOAST NOTIFICATIONS
// =======================================

(function () {
  // Injeta o CSS uma única vez
  const style = document.createElement("style");
  style.textContent = `
    #toast-container {
      position: fixed;
      bottom: 24px;
      right: 24px;
      display: flex;
      flex-direction: column-reverse;
      gap: 10px;
      z-index: 9999;
      pointer-events: none;
    }

    .toast {
      display: flex;
      align-items: flex-start;
      gap: 10px;
      min-width: 260px;
      max-width: 360px;
      padding: 12px 16px;
      border-radius: 10px;
      font-size: 14px;
      line-height: 1.45;
      font-family: inherit;
      pointer-events: auto;
      cursor: pointer;
      box-shadow: 0 4px 16px rgba(0,0,0,0.12);
      animation: toastIn 0.22s ease;
      transition: opacity 0.25s ease, transform 0.25s ease;
    }

    .toast.saindo {
      opacity: 0;
      transform: translateX(20px);
    }

    @keyframes toastIn {
      from { opacity: 0; transform: translateX(20px); }
      to   { opacity: 1; transform: translateX(0); }
    }

    .toast-icon { font-size: 16px; flex-shrink: 0; margin-top: 1px; }
    .toast-msg  { flex: 1; }

    /* Tipos */
    .toast.sucesso  { background: #ecfdf5; border: 1px solid #6ee7b7; color: #065f46; }
    .toast.erro     { background: #fef2f2; border: 1px solid #fca5a5; color: #7f1d1d; }
    .toast.aviso    { background: #fffbeb; border: 1px solid #fcd34d; color: #78350f; }
    .toast.info     { background: #eff6ff; border: 1px solid #93c5fd; color: #1e3a5f; }

    /* Dark mode */
    body.dark .toast.sucesso { background: #064e3b; border-color: #059669; color: #d1fae5; }
    body.dark .toast.erro    { background: #450a0a; border-color: #dc2626; color: #fecaca; }
    body.dark .toast.aviso   { background: #451a03; border-color: #d97706; color: #fde68a; }
    body.dark .toast.info    { background: #0c1a2e; border-color: #3b82f6; color: #bfdbfe; }

    /* Modal de confirmação */
    #toast-confirm-overlay {
      position: fixed; inset: 0;
      background: rgba(0,0,0,0.45);
      display: flex; align-items: center; justify-content: center;
      z-index: 10000;
      animation: fadeIn 0.15s ease;
    }

    @keyframes fadeIn {
      from { opacity: 0; } to { opacity: 1; }
    }

    #toast-confirm-box {
      background: #fff;
      border-radius: 12px;
      padding: 24px 28px;
      max-width: 340px;
      width: 90%;
      box-shadow: 0 8px 32px rgba(0,0,0,0.18);
      font-family: inherit;
    }

    body.dark #toast-confirm-box {
      background: #1e1e2e;
      color: #e2e2e2;
    }

    #toast-confirm-box p {
      margin: 0 0 20px;
      font-size: 15px;
      line-height: 1.5;
      color: inherit;
    }

    #toast-confirm-box .confirm-btns {
      display: flex;
      justify-content: flex-end;
      gap: 10px;
    }

    #toast-confirm-box button {
      padding: 8px 18px;
      border-radius: 7px;
      font-size: 14px;
      cursor: pointer;
      border: none;
      font-family: inherit;
    }

    #toast-confirm-box .btn-cancelar {
      background: #f1f1f1;
      color: #333;
    }

    body.dark #toast-confirm-box .btn-cancelar {
      background: #2e2e3e;
      color: #ccc;
    }

    #toast-confirm-box .btn-confirmar {
      background: #ef4444;
      color: #fff;
    }

    #toast-confirm-box .btn-confirmar:hover { background: #dc2626; }
  `;
  document.head.appendChild(style);

  // Cria o container dos toasts
  const container = document.createElement("div");
  container.id = "toast-container";
  document.body.appendChild(container);

  // ----------------------------------------
  // Função principal
  // ----------------------------------------
  const ICONES = {
    sucesso: "✓",
    erro: "✕",
    aviso: "⚠",
    info: "ℹ"
  };

  window.toast = function (mensagem, tipo = "info", duracao = 3500) {
    const el = document.createElement("div");
    el.className = `toast ${tipo}`;
    el.innerHTML = `
      <span class="toast-icon">${ICONES[tipo] || "ℹ"}</span>
      <span class="toast-msg">${mensagem}</span>
    `;

    // Fechar ao clicar
    el.addEventListener("click", () => fechar(el));

    container.appendChild(el);

    const timer = setTimeout(() => fechar(el), duracao);
    el.dataset.timer = timer;

    function fechar(el) {
      clearTimeout(Number(el.dataset.timer));
      el.classList.add("saindo");
      setTimeout(() => el.remove(), 280);
    }
  };

  // Atalhos
  window.toast.sucesso = (msg, dur) => window.toast(msg, "sucesso", dur);
  window.toast.erro    = (msg, dur) => window.toast(msg, "erro", dur);
  window.toast.aviso   = (msg, dur) => window.toast(msg, "aviso", dur);
  window.toast.info    = (msg, dur) => window.toast(msg, "info", dur);

  // ----------------------------------------
  // Substituto para confirm()
  // ----------------------------------------
  window.toastConfirm = function (mensagem, textoBotao = "Excluir") {
    return new Promise((resolve) => {
      const overlay = document.createElement("div");
      overlay.id = "toast-confirm-overlay";
      overlay.innerHTML = `
        <div id="toast-confirm-box">
          <p>${mensagem}</p>
          <div class="confirm-btns">
            <button class="btn-cancelar">Cancelar</button>
            <button class="btn-confirmar">${textoBotao}</button>
          </div>
        </div>
      `;

      overlay.querySelector(".btn-cancelar").addEventListener("click", () => {
        overlay.remove();
        resolve(false);
      });

      overlay.querySelector(".btn-confirmar").addEventListener("click", () => {
        overlay.remove();
        resolve(true);
      });

      document.body.appendChild(overlay);
    });
  };
})();
