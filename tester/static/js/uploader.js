document.addEventListener('DOMContentLoaded', () => {
    // 1. Инициализация блока "Последний тест"
    const lastQuizSlug = localStorage.getItem('last_quiz_slug');
    const lastQuizTitle = localStorage.getItem('last_quiz_title');

    if (lastQuizSlug && lastQuizTitle) {
        const lastQuizBox = document.getElementById('lastQuizBox');
        const lastQuizTitleEl = document.getElementById('lastQuizTitle');
        const lastQuizLink = document.getElementById('lastQuizLink');

        lastQuizTitleEl.textContent = lastQuizTitle;
        lastQuizLink.href = `/quiz/${lastQuizSlug}/`;
        lastQuizBox.style.display = 'flex';
    }

    // 2. Логика Drag and Drop
    const fileInput = document.getElementById('test_file');
    const dropZone = document.getElementById('dropZone');
    const dropZonePrompt = document.getElementById('dropZonePrompt');

    ['dragenter', 'dragover'].forEach(eventName => {
        dropZone.addEventListener(eventName, (e) => {
            e.preventDefault();
            e.stopPropagation();
            dropZone.classList.add('drag-over');
        }, false);
    });

    ['dragleave'].forEach(eventName => {
        dropZone.addEventListener(eventName, (e) => {
            e.preventDefault();
            e.stopPropagation();
            dropZone.classList.remove('drag-over');
        }, false);
    });

    // Исправленное событие Drop
    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropZone.classList.remove('drag-over');

        // Перехватываем файлы и передаем их в input
        const dt = e.dataTransfer;
        if (dt.files && dt.files.length > 0) {
            fileInput.files = dt.files;
            // Принудительно вызываем событие change для обновления UI
            fileInput.dispatchEvent(new Event('change'));
        }
    }, false);

    fileInput.addEventListener('change', function () {
        if (this.files && this.files.length > 0) {
            const file = this.files[0];
            const isZip = file.name.endsWith('.zip');
            const iconName = isZip ? 'file-archive' : 'file-json';

            dropZonePrompt.innerHTML = `
                <div class="selected-file-badge">
                    <i data-lucide="${iconName}" style="color: var(--primary); width: 18px; height: 18px;" stroke-width="2.5"></i>
                    <span>${file.name}</span>
                </div>
                <p class="file-info-text" style="margin-top: 12px;">Файл успешно подготовлен к отправке. Нажмите кнопку ниже.</p>
            `;

            if (typeof lucide !== 'undefined') {
                lucide.createIcons();
            }
        }
    });

    // 3. Логика копирования промпта
    const copyBtn = document.getElementById('copyPromptBtn');
    if (copyBtn) {
        copyBtn.addEventListener('click', () => {
            const promptText = document.getElementById('aiPromptText').innerText;

            navigator.clipboard.writeText(promptText).then(() => {
                copyBtn.innerHTML = '<i data-lucide="check" style="width: 13px; height: 13px;"></i> <span>Скопировано!</span>';
                copyBtn.style.borderColor = 'var(--success)';
                copyBtn.style.color = 'var(--success)';
                if (typeof lucide !== 'undefined') lucide.createIcons();

                setTimeout(() => {
                    copyBtn.innerHTML = '<i data-lucide="copy" style="width: 13px; height: 13px;"></i> <span>Скопировать промпт</span>';
                    copyBtn.style.borderColor = '';
                    copyBtn.style.color = '';
                    if (typeof lucide !== 'undefined') lucide.createIcons();
                }, 2000);
            }).catch(err => {
                console.error('Ошибка при копировании: ', err);
            });
        });
    }
});