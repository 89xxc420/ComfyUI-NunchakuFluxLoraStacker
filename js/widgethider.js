import { app } from "../../scripts/app.js";

console.log("ComfyUI-NunchakuFluxLoraStacker: JavaScript file loaded!");

let origProps = {};
let initialized = false;

const findWidgetByName = (node, name) => {
    return node.widgets ? node.widgets.find((w) => w.name === name) : null;
};

const doesInputWithNameExist = (node, name) => {
    // return node.inputs ? node.inputs.some((input) => input.name === name) : false;
    return false;
};

const HIDDEN_TAG = "tschide";

// Toggle Widget + change size (exactly like efficiency-nodes-comfyui)
function toggleWidget(node, widget, show = false, suffix = "") {
    if (!widget || doesInputWithNameExist(node, widget.name)) return;

    // Store the original properties of the widget if not already stored
    if (!origProps[widget.name]) {
        origProps[widget.name] = { origType: widget.type, origComputeSize: widget.computeSize };
    }

    const origSize = node.size;

    // Set the widget type and computeSize based on the show flag
    widget.type = show ? origProps[widget.name].origType : HIDDEN_TAG + suffix;
    widget.computeSize = show ? origProps[widget.name].origComputeSize : () => [0, -4];

    // Recursively handle linked widgets if they exist
    widget.linkedWidgets?.forEach(w => toggleWidget(node, w, show, ":" + widget.name));

    // Only update height immediately for non-LoRA Stacker nodes or when not in batch processing
    // For LoRA Stacker, height will be updated after all widgets are processed
    if (node.comfyClass !== "FluxLoraMultiLoader" || !suffix.includes("batch")) {
        const newHeight = node.computeSize()[1];
        node.setSize([node.size[0], newHeight]);
    }
}

// New function to handle widget visibility based on input_mode (exactly like efficiency-nodes-comfyui)
function handleInputModeWidgetsVisibility(node, inputModeValue) {
    // Utility function to generate widget names up to a certain count
    function generateWidgetNames(baseName, count) {
        return Array.from({ length: count }, (_, i) => `${baseName}_${i + 1}`);
    }

    const modelStrWidgets = [...generateWidgetNames("model_str", 10)];
    const clipStrWidgets = [...generateWidgetNames("clip_str", 10)];
    const loraWtWidgets = [...generateWidgetNames("lora_wt", 10)];

    const nodeVisibilityMap = {
        "FluxLoraMultiLoader": {
            "simple": [...modelStrWidgets, ...clipStrWidgets],
            "advanced": [...loraWtWidgets]
        }
    };

    const inputModeVisibilityMap = nodeVisibilityMap[node.comfyClass];
    
    if (!inputModeVisibilityMap || !inputModeVisibilityMap[inputModeValue]) return;

    // Reset all widgets to visible
    for (const key in inputModeVisibilityMap) {
        for (const widgetName of inputModeVisibilityMap[key]) {
            const widget = findWidgetByName(node, widgetName);
            toggleWidget(node, widget, true);
        }
    }

    // Hide the specific widgets for the current input_mode value
    for (const widgetName of inputModeVisibilityMap[inputModeValue]) {
        const widget = findWidgetByName(node, widgetName);
        toggleWidget(node, widget, false);
    }
}

// Handle multi-widget visibilities (exactly like efficiency-nodes-comfyui)
function handleVisibility(node, countValue, node_type) {
    const inputModeValue = findWidgetByName(node, "input_mode").value;
    const baseNamesMap = {
        "FluxLoraMultiLoader": ["lora_name", "model_str", "clip_str", "lora_wt"]
    };

    const baseNames = baseNamesMap[node_type];

    // For LoRA Stacker, first hide ALL widgets to ensure clean state
    if (node_type === "FluxLoraMultiLoader") {
        for (let i = 1; i <= 10; i++) {
            const nameWidget = findWidgetByName(node, `${baseNames[0]}_${i}`);
            const firstWidget = findWidgetByName(node, `${baseNames[1]}_${i}`);
            const secondWidget = findWidgetByName(node, `${baseNames[2]}_${i}`);
            const thirdWidget = findWidgetByName(node, `${baseNames[3]}_${i}`);
            
            if (nameWidget) toggleWidget(node, nameWidget, false);
            if (firstWidget) toggleWidget(node, firstWidget, false);
            if (secondWidget) toggleWidget(node, secondWidget, false);
            if (thirdWidget) toggleWidget(node, thirdWidget, false);
        }
    }

    for (let i = 1; i <= 10; i++) {
        const nameWidget = findWidgetByName(node, `${baseNames[0]}_${i}`);
        const firstWidget = findWidgetByName(node, `${baseNames[1]}_${i}`);
        const secondWidget = findWidgetByName(node, `${baseNames[2]}_${i}`);
        const thirdWidget = findWidgetByName(node, `${baseNames[3]}_${i}`);

        if (i <= countValue) {
            toggleWidget(node, nameWidget, true);

            if (node_type === "FluxLoraMultiLoader") {
                if (inputModeValue === "simple") {
                    toggleWidget(node, firstWidget, false);   // model_str
                    toggleWidget(node, secondWidget, false); // clip_str
                    toggleWidget(node, thirdWidget, true);  // lora_wt
                } else if (inputModeValue === "advanced") {
                    toggleWidget(node, firstWidget, true);   // model_str
                    toggleWidget(node, secondWidget, true);  // clip_str
                    toggleWidget(node, thirdWidget, false);   // lora_wt
                }
            }
        } else {
            toggleWidget(node, nameWidget, false);
            toggleWidget(node, firstWidget, false);
            toggleWidget(node, secondWidget, false);
            if (thirdWidget) {toggleWidget(node, thirdWidget, false);}
        }
    }
    
    // Final height update after all widgets are processed (exactly like efficiency-nodes-comfyui)
    if (typeof node.setSize === 'function' && typeof node.computeSize === 'function') {
        // Force a complete recalculation
        const newHeight = node.computeSize()[1];
        // Add padding to ensure all widgets are visible
        const paddedHeight = newHeight + (node_type === "FluxLoraMultiLoader" ? 30 : 0);
        node.setSize([node.size[0], paddedHeight]);
        
        // Force graph update to ensure proper rendering
        if (node.graph && typeof node.graph.setDirty === 'function') {
            node.graph.setDirty(true, true);
        }
        
        // Additional height adjustment for LoRA Stacker with multiple attempts
        if (node_type === "FluxLoraMultiLoader") {
            // Multiple attempts to ensure proper height calculation
            [10, 50, 100, 200].forEach(delay => {
                setTimeout(() => {
                    const finalHeight = node.computeSize()[1];
                    const finalPaddedHeight = finalHeight + 30;
                    if (finalPaddedHeight !== node.size[1]) {
                        node.setSize([node.size[0], finalPaddedHeight]);
                        if (node.graph && typeof node.graph.setDirty === 'function') {
                            node.graph.setDirty(true, true);
                        }
                    }
                }, delay);
            });
        }
    }
}

// LoRA Stacker Handlers (exactly like efficiency-nodes-comfyui)
function handleLoRAStackerInputMode(node, widget) {
    console.log("ComfyUI-NunchakuFluxLoraStacker: handleLoRAStackerInputMode called with value:", widget.value);
    handleInputModeWidgetsVisibility(node, widget.value);
    handleVisibility(node, findWidgetByName(node, "lora_count").value, "FluxLoraMultiLoader");
    
    // Force immediate update for LoRA Stacker
    setTimeout(() => {
        if (typeof node.setSize === 'function' && typeof node.computeSize === 'function') {
            const newHeight = node.computeSize()[1];
            node.setSize([node.size[0], newHeight]);
            if (node.graph && typeof node.graph.setDirty === 'function') {
                node.graph.setDirty(true, true);
            }
        }
    }, 50);
}

function handleLoRAStackerLoraCount(node, widget) {
    console.log("ComfyUI-NunchakuFluxLoraStacker: handleLoRAStackerLoraCount called with value:", widget.value);
    handleVisibility(node, widget.value, "FluxLoraMultiLoader");
    
    // Force immediate update for LoRA Stacker
    setTimeout(() => {
        if (typeof node.setSize === 'function' && typeof node.computeSize === 'function') {
            const newHeight = node.computeSize()[1];
            node.setSize([node.size[0], newHeight]);
            if (node.graph && typeof node.graph.setDirty === 'function') {
                node.graph.setDirty(true, true);
            }
        }
    }, 50);
}

// Create a map of node titles to their respective widget handlers (exactly like efficiency-nodes-comfyui)
const nodeWidgetHandlers = {
    "FluxLoraMultiLoader": {
        'input_mode': handleLoRAStackerInputMode,
        'lora_count': handleLoRAStackerLoraCount
    }
};

// In the main function where widgetLogic is called
function widgetLogic(node, widget) {
    // Retrieve the handler for the current node title and widget name
    const handler = nodeWidgetHandlers[node.comfyClass]?.[widget.name];
    if (handler) {
        handler(node, widget);
    }
}

app.registerExtension({
    name: "nunchakufluxlorastacker.widgethider",
    nodeCreated(node) {
        console.log("ComfyUI-NunchakuFluxLoraStacker: Node created:", node.comfyClass);
        if (!nodeWidgetHandlers[node.comfyClass]) {
            return;
        }
        
        // Special handling for LoRA Stacker - initialize with correct widget visibility
        if (node.comfyClass === "FluxLoraMultiLoader") {
            console.log("ComfyUI-NunchakuFluxLoraStacker: Processing LoRA Stacker node");
            const loraCountWidget = findWidgetByName(node, "lora_count");
            const inputModeWidget = findWidgetByName(node, "input_mode");
            console.log("ComfyUI-NunchakuFluxLoraStacker: lora_count widget found:", !!loraCountWidget);
            console.log("ComfyUI-NunchakuFluxLoraStacker: input_mode widget found:", !!inputModeWidget);
            
            if (loraCountWidget && inputModeWidget) {
                // First, hide all widgets to get a clean state
                const baseNames = ["lora_name", "model_str", "clip_str", "lora_wt"];
                for (let i = 1; i <= 10; i++) {
                    for (const baseName of baseNames) {
                        const widget = findWidgetByName(node, `${baseName}_${i}`);
                        if (widget) {
                            toggleWidget(node, widget, false);
                        }
                    }
                }
                
                // Initialize with current values
                handleInputModeWidgetsVisibility(node, inputModeWidget.value);
                handleVisibility(node, loraCountWidget.value, "FluxLoraMultiLoader");
                
                // Force initial height calculation with multiple attempts
                [50, 100, 200, 500].forEach(delay => {
                    setTimeout(() => {
                        if (typeof node.setSize === 'function' && typeof node.computeSize === 'function') {
                            const newHeight = node.computeSize()[1];
                            // Add some padding to ensure all widgets are visible
                            const paddedHeight = newHeight + 20;
                            node.setSize([node.size[0], paddedHeight]);
                            if (node.graph && typeof node.graph.setDirty === 'function') {
                                node.graph.setDirty(true, true);
                            }
                        }
                    }, delay);
                });
            }
        }
        
        for (const w of node.widgets || []) {
            if (!nodeWidgetHandlers[node.comfyClass][w.name]) continue;
            let widgetValue = w.value;

            // Store the original descriptor if it exists
            let originalDescriptor = Object.getOwnPropertyDescriptor(w, 'value');
            if (!originalDescriptor) {
                originalDescriptor = Object.getOwnPropertyDescriptor(w.constructor.prototype, 'value');
            }

            widgetLogic(node, w);

            Object.defineProperty(w, 'value', {
                get() {
                    // If there's an original getter, use it. Otherwise, return widgetValue.
                    let valueToReturn = originalDescriptor && originalDescriptor.get
                        ? originalDescriptor.get.call(w)
                        : widgetValue;

                    return valueToReturn;
                },
                set(newVal) {
                    // If there's an original setter, use it. Otherwise, set widgetValue.
                    if (originalDescriptor && originalDescriptor.set) {
                        originalDescriptor.set.call(w, newVal);
                    } else {
                        widgetValue = newVal;
                    }

                    widgetLogic(node, w);
                }
            });
        }
        setTimeout(() => {initialized = true;}, 500);
    }
});

