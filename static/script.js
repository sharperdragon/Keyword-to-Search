import { debounce, createDropdown, buildSearchClause, loadLocalStorage} from './utils.js';
let lastSavedInput = "";
const STORAGE_KEY = "keywordSearchHistory";

const inputField = document.getElementById("input_ids");
const questionList = document.getElementById("question_list");
const outputText = document.getElementById("output_text");
const selectAllButton = document.getElementById("select_all");
const deselectAllButton = document.getElementById("deselect_all");
const copyButton = document.getElementById("copy_button");
const historySelect = document.getElementById("history_select");

let selectedField = "Text"; // Default field value

// Initialize Options (Field Selection) - modularized
function initializeOptions() {
    const modeSection = document.getElementById("mode_section");
    if (!modeSection) return;

    // Remove any existing options_container to avoid duplicates
    const existing = modeSection.querySelector(".options_container");
    if (existing) existing.remove();


    const fieldOptions = ["Text", "Front", "NID", "CID"];
    fieldOptions.forEach(option => {
        optionDiv.setAttribute("data-value", option);
        optionDiv.addEventListener("click", () => {
            selectedField = optionDiv.getAttribute("data-value"); // Update selected field
            // Update highlighting
            optionsContainer.querySelectorAll(".field_option").forEach(el => {
                el.style.background = el.getAttribute("data-value") === selectedField ? "#e6f0ff" : "transparent";
            });
            updateOutput(); // Update output based on the selected field
        });
        optionsContainer.appendChild(optionDiv);
    });

    // Show/hide options on hover
    modeSection.addEventListener("mouseenter", () => {
        optionsContainer.style.display = "flex";
    });
    modeSection.addEventListener("mouseleave", () => {
        optionsContainer.style.display = "none";
    });
    optionsContainer.addEventListener("mouseenter", () => {
        optionsContainer.style.display = "flex";
    });
    optionsContainer.addEventListener("mouseleave", () => {
        optionsContainer.style.display = "none";
    });

    modeSection.appendChild(optionsContainer);
}

// Update the question list dynamically and save to history on input
inputField.addEventListener("input", debounce(() => {
    updateQuestionList(); // update displayed items only
}, 300));

// Event listener for Select All button
selectAllButton.addEventListener("click", () => {
    toggleSelection(true);
    updateOutput();
});

function saveToHistory(entry) {
    if (!entry || !entry.trim()) return;
    const fieldValue = selectedField;
    let history = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    history = history.filter(e => e.input !== entry); // Remove duplicates
    history.unshift({input: entry, field: fieldValue}); // Add to top
    if (history.length > 20) history = history.slice(0, 20); // Limit size
    localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
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
    const history = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    historySelect.innerHTML = '<option value="">-- Select from history --</option>';
    history.forEach(item => {
        const option = document.createElement("option");
        option.value = JSON.stringify(item);
        option.textContent = `${item.input} (Field: ${item.field})`;
        historySelect.appendChild(option);
    });
}

historySelect.addEventListener("change", () => {
    if (historySelect.value) {
        try {
            const selected = JSON.parse(historySelect.value);
            inputField.value = selected.input;
            if(selected.field) {
                selectedField = selected.field;
            }
            updateQuestionList();
        } catch(e) {
            // Fallback if parsing fails
            inputField.value = historySelect.value;
            updateQuestionList();
        }
    }
});

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

// Update the output based on the selected field
function updateOutput() {
    const selectedIDs = Array.from(document.querySelectorAll("#question_list input:checked"))
                             .map(input => input.value);

    if (!selectedIDs.length) {
        outputText.value = "";
        return;
    }

    const outputParts = [];

    const fieldBehavior = {
        "Text": true,
        "Front": true,
        "CID": false,
        "NID": false
    };
    const needsWildcard = fieldBehavior[selectedField] ?? true;

    selectedIDs.forEach(entry => {
        const words = entry.trim().split(/\s+/).map(w => w.trim()).filter(w => w.length > 0);

        if (words.length === 1) {
            if (needsWildcard) {
                outputParts.push(`(${selectedField}:*${words[0]}*)`);
            } else {
                outputParts.push(`(${selectedField}:${words[0]})`);
            }
        } else if (words.length > 1) {
            const wordClauses = words.map(w => {
                if (needsWildcard) {
                    return `(${selectedField}:*${w}*)`;
                } else {
                    return `(${selectedField}:${w})`;
                }
            });
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
});

// Ensure dropdown loads on page open
document.addEventListener("DOMContentLoaded", () => {
    if (!localStorage.getItem(STORAGE_KEY)) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify([{input: "Apr 21, 10:00 → (Text:*test*)", field: "Text"}]));
    }
    updateHistoryDropdown();
    initializeOptions(); // Initialize field options on page load
});
