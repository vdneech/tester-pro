window.showModal = function(title, message, btnText, onConfirm) {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    
    overlay.innerHTML = `
        <div class="modal-content">
            <h3 style="margin-top:0">${title}</h3>
            <p style="color: var(--text-muted);">${message}</p>
            <button class="btn btn-primary" id="modalBtn" style="margin-top: 15px; width: 100%;">
                ${btnText}
            </button>
        </div>
    `;
    
    document.body.appendChild(overlay);
    
    document.getElementById('modalBtn').onclick = () => {
        document.body.removeChild(overlay);
        if (onConfirm) onConfirm();
    };
};