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
        document.getElementById("output_text").value = "";
        return;
    }

    // Helper to normalize case and spacing
    const normalize = str => str.trim().toLowerCase();

    // Step 1: Group by suffix (e.g., last 2 words)
    const suffixGroups = {};
    const uniqueEntries = [];

    selectedIDs.forEach(entry => {
        if (entry.startsWith('"') && entry.endsWith('"')) {
            uniqueEntries.push(entry); // preserve the quoted entry
            return;
        }

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
        const nonEmptyPrefixes = prefixes.filter(p => p.trim().length > 0);
        const suffixWords = suffix.split(" ").map(w => `Text:*${w}*`).join(" ");

        if (nonEmptyPrefixes.length > 1) {
            const prefixGroup = nonEmptyPrefixes.map(p => {
                return p.trim().split(" ").filter(Boolean).map(word => `Text:*${word}*`).join(" ");
            }).join(" OR ");
            outputParts.push(`((${prefixGroup}) ${suffixWords})`);
        } else if (nonEmptyPrefixes.length === 1) {
            const prefixWords = nonEmptyPrefixes[0].trim().split(" ").map(word => `Text:*${word}*`).join(" ");
            outputParts.push(`(${prefixWords} ${suffixWords})`);
        } else {
            outputParts.push(`(${suffixWords})`);
        }
    }

    // Step 3: Add remaining entries
    uniqueEntries.forEach(entry => {
        if (entry.startsWith('"') && entry.endsWith('"')) {
            const clean = entry.slice(1, -1);
            outputParts.push(`("Text:*${clean}*")`);
        } else if (entry.includes(" ")) {
            outputParts.push(`("Text:*${entry}*")`);
        } else {
            outputParts.push(`(Text:*${entry}*)`);
        }
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
