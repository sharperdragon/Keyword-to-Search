function debounce(func, delay = 300) {
    let timeout;
    return (...args) => {
        clearTimeout(timeout);
        timeout = setTimeout(() => func(...args), delay);
    };
}

const inputField = document.getElementById("input_ids");
const questionList = document.getElementById("question_list");
const outputText = document.getElementById("output_text");
const selectAllButton = document.getElementById("select_all");
const deselectAllButton = document.getElementById("deselect_all");
const copyButton = document.getElementById("copy_button");
const historySelect = document.getElementById("history_select");

// Update the question list dynamically and save to history on input
let lastSavedInput = "";
inputField.addEventListener("input", debounce(() => {
    const val = inputField.value.trim();
    updateQuestionList();
    if (val && val !== lastSavedInput) {
        saveToHistory(val);
        lastSavedInput = val;
    }
}, 300));

// Event listener for Select All button
selectAllButton.addEventListener("click", () => {
    toggleSelection(true);
    updateOutput();
});

function saveToHistory(entry) {
    if (!entry || !entry.trim()) return;
    let history = JSON.parse(localStorage.getItem("conversionHistory") || "[]");
    history = history.filter(e => e !== entry); // Remove duplicates
    history.unshift(entry); // Add to top
    if (history.length > 20) history = history.slice(0, 20); // Limit size
    localStorage.setItem("conversionHistory", JSON.stringify(history));
    updateHistoryDropdown();
    
    // Visual feedback
    const feedback = document.createElement("span");
    feedback.className = "history-feedback";
    feedback.textContent = "+1";
    const parent = historySelect.parentElement;
    parent.style.position = "relative";
    parent.appendChild(feedback);
    setTimeout(() => feedback.remove(), 1000);
}

function updateHistoryDropdown() {
    const history = JSON.parse(localStorage.getItem("conversionHistory") || "[]");
    historySelect.innerHTML = '<option value="">-- Select from history --</option>';
    history.forEach(item => {
        const option = document.createElement("option");
        option.value = item;
        option.textContent = item;
        historySelect.appendChild(option);
    });
}

historySelect.addEventListener("change", () => {
    if (historySelect.value) {
        inputField.value = historySelect.value;
        updateQuestionList();
    }
});

// Removed inline call to populateHistoryDropdown to avoid race conditions

// Event listener for Deselect All button
deselectAllButton.addEventListener("click", () => {
    toggleSelection(false);
    updateOutput();
});

function updateQuestionList() {
    questionList.innerHTML = ""; // Clear previous list
    const inputIDs = inputField.value.trim();

    if (!inputIDs) {
        if (lastSavedInput !== "") {
            saveToHistory("");
            lastSavedInput = "";
            updateHistoryDropdown();
        }
        return;
    }

    const ids = [];
    const regex = /"([^"]+)"|([^,]+)/g;
    let match;
    while ((match = regex.exec(inputIDs)) !== null) {
        const item = match[1] ? `"${match[1].trim()}"` : match[2].trim();
        if (item) ids.push(item);
    }
    
    ids.forEach((id, index) => {
        const label = document.createElement("label");
        label.innerHTML = `
            <input type="checkbox" value="${id}">
            <span class="number">${index + 1})</span>
            <span class="space"> </span> 
            <span class="id">${id}</span>`;
        questionList.appendChild(label);
        questionList.appendChild(document.createElement("br"));
    });
    updateOutput();
}

function toggleSelection(selectAll) {
    const checkboxes = questionList.querySelectorAll("input[type='checkbox']");
    checkboxes.forEach(checkbox => {
        checkbox.checked = selectAll;
        checkbox.dispatchEvent(new Event("change"));
    });
}

function updateOutput() {
    const selectedIDs = Array.from(document.querySelectorAll("#question_list input:checked"))
                             .map(input => input.value);

    if (!selectedIDs.length) {
        outputText.value = "";
        return;
    }

    const outputParts = [];

    selectedIDs.forEach(entry => {
        const words = entry.trim().split(/\s+/).map(w => w.trim()).filter(w => w.length > 0);

        if (words.length === 1) {
            outputParts.push(`(Text:*${words[0]}*)`);
        } else if (words.length > 1) {
            const wordClauses = words.map(w => `(Text:*${w}*)`);
            outputParts.push(`(${wordClauses.join(" ")})`);
        }
    });

    outputText.value = `(${outputParts.join(" OR ")})`;
}

questionList.addEventListener("change", updateOutput);

copyButton.addEventListener("click", () => {
    outputText.select();
    outputText.setSelectionRange(0, 99999); // For mobile compatibility
    navigator.clipboard.writeText(outputText.value).then(() => {
        const val = inputField.value.trim();
        if (val && val !== lastSavedInput) {
            saveToHistory(val);
            lastSavedInput = val;
        }
        updateHistoryDropdown();
        copyButton.textContent = "Copied!";
        setTimeout(() => (copyButton.textContent = "Copy to Clipboard"), 1500);
    });

// Ensure dropdown loads on page open
document.addEventListener("DOMContentLoaded", () => {
    if (!localStorage.getItem("conversionHistory")) {
        localStorage.setItem("conversionHistory", JSON.stringify(["Apr 21, 10:00 → (Text:*test*)"]));
    }
    updateHistoryDropdown();
});
});
