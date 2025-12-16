
async function loadWpSites() {
    try {
        const response = await fetch('/api/sites');
        WP_SITES_PRESETS = await response.json();
        return WP_SITES_PRESETS;
    } catch (err) {
        console.error('Erro ao carregar sites', err);
        return [];
    }
}

(function () {
    document.addEventListener("DOMContentLoaded", async () => {
        const multi = document.getElementById("wpSitesMulti");
        if (!multi) return;

        const baseUrlInput = document.getElementById("wpBaseUrl");
        const userInput = document.getElementById("wpUser");
        const passInput = document.getElementById("wpAppPassword");
        const categoryInput = document.getElementById("wpCategoryId");
        const statusSelect = document.getElementById("wpStatus");

        const sites = await loadWpSites();
        
        if (!baseUrlInput || !userInput || !passInput) return;

        multi.innerHTML = "";

        (sites || []).forEach((site) => {

            if (!site || !site.id || !site.label) return;

            const item = document.createElement("div");
            item.className = "site-pill";
            item.dataset.siteId = site.id;

            const left = document.createElement("div");
            left.className = "site-pill-left";

            const title = document.createElement("div");
            title.className = "site-pill-title";
            title.textContent = site.label;

            const sub = document.createElement("div");
            sub.className = "site-pill-sub";
            sub.textContent = site.baseUrl || "";

            left.appendChild(title);
            left.appendChild(sub);

            const right = document.createElement("div");
            right.className = "site-pill-right";

            const badge = document.createElement("span");
            badge.className = "site-pill-badge";
            badge.textContent = "Principal";

            const cb = document.createElement("input");
            cb.type = "checkbox";
            cb.value = site.id;

            right.appendChild(badge);
            right.appendChild(cb);

            item.appendChild(left);
            item.appendChild(right);

            item.addEventListener("click", (e) => {
                if (e.target === cb) return;
                cb.checked = !cb.checked;
                cb.dispatchEvent(new Event("change"));
            });

            cb.addEventListener("change", () => {
                syncPrimaryFromSelection();
            });

            multi.appendChild(item);
        });

        function getSelectedIds() {
            return Array.from(multi.querySelectorAll("input[type=checkbox]:checked"))
                .map((c) => c.value);
        }

        window.getSelectedWpSites = function () {
            return getSelectedIds();
        };

        function setPrimaryUi(primaryId) {
            Array.from(multi.querySelectorAll(".site-pill")).forEach((pill) => {
                const pid = pill.dataset.siteId;
                pill.classList.toggle("primary", pid === primaryId);
            });
        }

        function applySiteAsPrimary(siteId) {
            const site = (WP_SITES_PRESETS || []).find((s) => s.id === siteId);
            if (!site) return;

            baseUrlInput.value = site.baseUrl || "";
            baseUrlInput.readOnly = true;

            if (site.user) userInput.value = site.user;
            if (site.appPassword) passInput.value = site.appPassword;

            if (categoryInput && typeof site.defaultCategoryId === "number") {
                categoryInput.value = String(site.defaultCategoryId);
            }

            if (statusSelect && site.defaultStatus) {
                const allowed = ["draft", "publish"];
                if (allowed.includes(site.defaultStatus)) {
                    statusSelect.value = site.defaultStatus;
                }
            }

            setPrimaryUi(siteId);

            if (typeof window.loadWpCategories === "function") {
                setTimeout(() => window.loadWpCategories(), 150);
            }
        }

        function syncPrimaryFromSelection() {
            const selected = getSelectedIds();

            if (selected.length === 0) {
                baseUrlInput.value = "";
                setPrimaryUi(null);

                const categorySelect = document.getElementById("wpCategorySelect");
                if (categorySelect) categorySelect.innerHTML = '<option value="">Informe a URL do WordPress</option>';
                if (categoryInput) categoryInput.value = "0";
                return;
            }

            applySiteAsPrimary(selected[0]);
        }
    });
})();
