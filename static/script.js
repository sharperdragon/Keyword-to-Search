const inputField = document.getElementById("input_ids");
const questionList = document.getElementById("question_list");
const selectAllButton = document.getElementById("select_all");
const deselectAllButton = document.getElementById("deselect_all");

// Update the question list dynamically when input changes
inputField.addEventListener("input", updateQuestionList);

// Event listener for Select All button
selectAllButton.addEventListener("click", () => {
    toggleSelection(true);
    updateOutput();
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
        return; // Do nothing if input is empty
    }

    const ids = inputIDs.split(",").map(id => id.trim()).filter(id => id);
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
        document.getElementById("output_text").value = "";
        return;
    }

    // Helper to normalize case and spacing
    const normalize = str => str.trim().toLowerCase();

    // Step 1: Group by suffix (e.g., last 2 words)
    const suffixGroups = {};
    const uniqueEntries = [];

    selectedIDs.forEach(entry => {
        const words = entry.trim().split(/\s+/);
        if (words.length >= 2) {
            const suffix = words.slice(-2).map(normalize).join(" ");
            const prefix = words.slice(0, -2).join(" ");
            if (!suffixGroups[suffix]) suffixGroups[suffix] = [];
            suffixGroups[suffix].push(prefix);
        } else {
            uniqueEntries.push(entry.trim());
        }
    });

    // Step 2: Construct the output
    const outputParts = [];

    for (const [suffix, prefixes] of Object.entries(suffixGroups)) {
        const suffixWords = suffix.split(" ").map(w => `Text:*${w}*`).join(" ");
        const nonEmptyPrefixes = prefixes.filter(p => p.trim().length > 0);

        if (nonEmptyPrefixes.length > 1) {
            const groupedPrefixes = nonEmptyPrefixes.map(p => {
                const pw = p.trim().split(" ").filter(Boolean).map(word => `Text:*${word}*`).join(" ");
                return `(${pw})`;
            }).join(" OR ");
            outputParts.push(`(${suffixWords}(${groupedPrefixes}))`);
        } else if (nonEmptyPrefixes.length === 1) {
            const prefixWords = nonEmptyPrefixes[0].trim().split(" ").map(word => `Text:*${word}*`).join(" ");
            outputParts.push(`(${prefixWords} ${suffixWords})`);
        } else {
            outputParts.push(`(${suffixWords})`);
        }
    }

    // Step 3: Add remaining entries
    uniqueEntries.forEach(entry => {
        const words = entry.trim().split(/\s+/).map(w => `Text:*${w}*`);
        outputParts.push(`(${words.join(" ")})`);
    });

    document.getElementById("output_text").value = `(${outputParts.join(" OR ")})`;
}

questionList.addEventListener("change", updateOutput);

const copyButton = document.getElementById("copy_button");
copyButton.addEventListener("click", () => {
    const outputText = document.getElementById("output_text");
    outputText.select();
    outputText.setSelectionRange(0, 99999); // For mobile compatibility
    navigator.clipboard.writeText(outputText.value).then(() => {
        copyButton.textContent = "Copied!";
        setTimeout(() => (copyButton.textContent = "Copy to Clipboard"), 1500);
    });
});
