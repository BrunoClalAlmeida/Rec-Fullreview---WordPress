// ===== Utilitários =====
function stripHtml(html) {
    const div = document.createElement("div");
    div.innerHTML = html;
    return div.textContent || div.innerText || "";
}

function countWordsFromHtml(html) {
    if (!html) return 0;
    const text = stripHtml(html);
    if (!text) return 0;
    return text
        .split(/\s+/)
        .map((t) => t.trim())
        .filter((t) => t.length > 0).length;
}

function slugify(text) {
    return text
        .toString()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, "")
        .trim()
        .replace(/\s+/g, "-")
        .replace(/-+/g, "-");
}

function generateRowId() {
    return (
        Date.now().toString(16) +
        Math.floor(Math.random() * 999999).toString(16)
    );
}
