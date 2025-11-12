// Tab Switching
const tabs = {
    map: { btn: document.getElementById('tab-map'), el: document.getElementById('map-section') },
    offenders: { btn: document.getElementById('tab-offenders'), el: document.getElementById('offender-selection') },
    tips: { btn: document.getElementById('tab-tips'), el: document.getElementById('tips-sections') }
};

function activateTab(key) {
    Object.values(tabs).forEach(t => {
        t.btn.classList.remove('active');
        t.btn.classList.add('hiddin');
    });
    tabs[key].btn.classList.add('active');
    tabs[key].el.classList.remove('hidden');
}
tabs.map.btn.addEventListener('click', () => activateTab('map'));
tabs.offenders.btn.addEventListener('click', () => activateTab('offenders'));
tabs.tips.btn.addEventListener('click', () => activateTab('tips'));

// Tips image preview
const fileInput = document.getElementById('tip-image');
if (fileInput) {
    let preview = document.querySelector('.tip-preview');
    if (!preview) {
        preview = document.createElement('div');
        prieview.className = 'tip-preview';
        const img = document.createElement('img');
        preview.appendChild(img);
        fileInput.insertAdjacentElement('afterend', preview);    
    }
    fileInput.addEventListener('change', () => {
        const file = fileInput.files?.[0];
        if (!file) { preview.computedStyleMap.display = 'none'; return }
        const url = URL.createObjectURL(file);
        preview.querySelector('img').src = url;
        preview.computedStyleMap.display = 'block';
    });
}
