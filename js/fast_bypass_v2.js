import { app } from "../../scripts/app.js";

// Constants - コピー from rgthree
const MODE_ALWAYS = 0;
const MODE_MUTE = 2;
const MODE_BYPASS = 4;

// Property Keys - コピー from rgthree
const PROPERTY_SORT = "sort";
const PROPERTY_SORT_CUSTOM_ALPHA = "customSortAlphabet";
const PROPERTY_MATCH_COLORS = "matchColors";
const PROPERTY_MATCH_TITLE = "matchTitle";
const PROPERTY_SHOW_NAV = "showNav";
const PROPERTY_SHOW_ALL_GRAPHS = "showAllGraphs";
const PROPERTY_RESTRICTION = "toggleRestriction";
const PROPERTY_MODE = "effectMode";

// Simple service to schedule refresh - rgthreeのFAST_GROUPS_SERVICEを簡易実装
class SimpleRefreshService {
    constructor() {
        this.nodes = [];
        this.scheduled = false;
    }
    
    addNode(node) {
        if (!this.nodes.includes(node)) {
            this.nodes.push(node);
            this.scheduleRefresh();
        }
    }
    
    removeNode(node) {
        const index = this.nodes.indexOf(node);
        if (index > -1) {
            this.nodes.splice(index, 1);
        }
    }
    
    scheduleRefresh() {
        if (this.scheduled) return;
        this.scheduled = true;
        setTimeout(() => {
            this.refresh();
            this.scheduled = false;
            if (this.nodes.length > 0) {
                this.scheduleRefresh();
            }
        }, 500);
    }
    
    refresh() {
        for (const node of this.nodes) {
            if (!node.removed) {
                node.refreshWidgets();
            }
        }
    }
}

const SERVICE = new SimpleRefreshService();

app.registerExtension({
    name: "nunchakufluxlorastacker.fast_groups_bypass_v2.fixed",
    
    // rgthreeと同じ: beforeRegisterNodeDefでプロパティ定義
    async beforeRegisterNodeDef(nodeType, nodeData, app) {
        if (nodeData.name === "FastGroupsBypasserV2") {
            // プロパティ定義 - rgthreeから完全コピー
            nodeType["@matchColors"] = { type: "string" };
            nodeType["@matchTitle"] = { type: "string" };
            nodeType["@showNav"] = { type: "boolean" };
            nodeType["@showAllGraphs"] = { type: "boolean" };
            nodeType["@sort"] = {
                type: "combo",
                values: ["position", "alphanumeric", "custom alphabet"]
            };
            nodeType["@customSortAlphabet"] = { type: "string" };
            nodeType["@toggleRestriction"] = {
                type: "combo",
                values: ["default", "max one", "always one"]
            };
            nodeType["@effectMode"] = {
                type: "combo",
                values: ["Bypass", "Mute"]
            };

            // 右クリックメニューに項目を追加（prototypeに追加）
            const origGetExtraMenuOptions = nodeType.prototype.getExtraMenuOptions;
            nodeType.prototype.getExtraMenuOptions = function(canvas, options) {
                const r = origGetExtraMenuOptions ? origGetExtraMenuOptions.apply(this, arguments) : options;
                
                r.push(
                    null, // セパレーター
                    {
                        content: "🎨 Edit Match Colors",
                        callback: () => {
                            const currentValue = this.properties[PROPERTY_MATCH_COLORS] || "";
                            const newValue = prompt("Match Colors (comma separated, e.g. red,blue,#ff0000):", currentValue);
                            if (newValue !== null) {
                                this.properties[PROPERTY_MATCH_COLORS] = newValue;
                                this.onPropertyChanged && this.onPropertyChanged(PROPERTY_MATCH_COLORS, newValue);
                            }
                        }
                    },
                    {
                        content: "📝 Edit Match Title",
                        callback: () => {
                            const currentValue = this.properties[PROPERTY_MATCH_TITLE] || "";
                            const newValue = prompt("Match Title (regex pattern):", currentValue);
                            if (newValue !== null) {
                                this.properties[PROPERTY_MATCH_TITLE] = newValue;
                                this.onPropertyChanged && this.onPropertyChanged(PROPERTY_MATCH_TITLE, newValue);
                            }
                        }
                    }
                );
                
                return r;
            };
        }
    },

    // rgthreeと同じ: nodeCreatedで初期化
    nodeCreated(node) {
        if (node.comfyClass !== "FastGroupsBypasserV2") return;

        // プロパティ初期化 - rgthreeから完全コピー
        if (!node.properties) node.properties = {};
        if (node.properties[PROPERTY_MATCH_COLORS] === undefined) node.properties[PROPERTY_MATCH_COLORS] = "";
        if (node.properties[PROPERTY_MATCH_TITLE] === undefined) node.properties[PROPERTY_MATCH_TITLE] = "";
        if (node.properties[PROPERTY_SHOW_NAV] === undefined) node.properties[PROPERTY_SHOW_NAV] = true;
        if (node.properties[PROPERTY_SHOW_ALL_GRAPHS] === undefined) node.properties[PROPERTY_SHOW_ALL_GRAPHS] = true;
        if (node.properties[PROPERTY_SORT] === undefined) node.properties[PROPERTY_SORT] = "position";
        if (node.properties[PROPERTY_SORT_CUSTOM_ALPHA] === undefined) node.properties[PROPERTY_SORT_CUSTOM_ALPHA] = "";
        if (node.properties[PROPERTY_RESTRICTION] === undefined) node.properties[PROPERTY_RESTRICTION] = "default";
        if (node.properties[PROPERTY_MODE] === undefined) node.properties[PROPERTY_MODE] = "Bypass";
        
        node.serialize_widgets = false;
        node.removed = false;
        
        // 固定ウィジェット数を追跡（削除しないウィジェット）
        node.fixedWidgetsCount = 0;

        // refreshWidgets - rgthreeから完全コピー（簡略版）
        node.refreshWidgets = function() {
            console.log("[FastBypassV2] refreshWidgets called");
            console.log("[FastBypassV2] properties:", this.properties);
            if (!app || !app.graph) return;
            const graph = app.graph;
            
            let groups = [];
            if (graph._groups) groups = [...graph._groups];
            
            // Sort - rgthreeのロジック
            const sortMode = this.properties[PROPERTY_SORT] || "position";
            if (sortMode === "custom alphabet") {
                const alphaStr = (this.properties[PROPERTY_SORT_CUSTOM_ALPHA] || "").replace(/\n/g, "");
                if (alphaStr && alphaStr.trim()) {
                    const alphabet = alphaStr.includes(",") 
                        ? alphaStr.toLowerCase().split(",").map(s => s.trim())
                        : alphaStr.toLowerCase().trim().split("");
                    
                    groups.sort((a, b) => {
                        const titleA = (a.title || "").toLowerCase();
                        const titleB = (b.title || "").toLowerCase();
                        let idxA = alphabet.findIndex(prefix => titleA.startsWith(prefix));
                        let idxB = alphabet.findIndex(prefix => titleB.startsWith(prefix));
                        if (idxA !== -1 && idxB !== -1) {
                            const ret = idxA - idxB;
                            if (ret === 0) return titleA.localeCompare(titleB);
                            return ret;
                        }
                        if (idxA !== -1) return -1;
                        if (idxB !== -1) return 1;
                        return titleA.localeCompare(titleB);
                    });
                }
            } else if (sortMode === "alphanumeric") {
                groups.sort((a, b) => (a.title || "").localeCompare(b.title || ""));
            } else {
                // position
                groups.sort((a, b) => {
                    if (Math.abs(a.pos[1] - b.pos[1]) > 50) return a.pos[1] - b.pos[1];
                    return a.pos[0] - b.pos[0];
                });
            }

            // Filter by color - rgthreeのロジック
            console.log("[FastBypassV2] matchColors:", this.properties[PROPERTY_MATCH_COLORS]);
            console.log("[FastBypassV2] matchTitle:", this.properties[PROPERTY_MATCH_TITLE]);
            let filterColors = (this.properties[PROPERTY_MATCH_COLORS] || "").split(",").filter(c => c.trim());
            console.log("[FastBypassV2] filterColors:", filterColors);
            if (filterColors.length) {
                filterColors = filterColors.map(color => {
                    color = color.trim().toLowerCase();
                    if (typeof LGraphCanvas !== "undefined" && LGraphCanvas.node_colors && LGraphCanvas.node_colors[color]) {
                        color = LGraphCanvas.node_colors[color].groupcolor;
                    }
                    color = color.replace("#", "").toLowerCase();
                    if (color.length === 3) {
                        color = color.replace(/(.)(.)(.)/, "$1$1$2$2$3$3");
                    }
                    return `#${color}`;
                });
            }
            
            // Filter groups - rgthreeのロジック
            let filteredGroups = [];
            for (const group of groups) {
                // Color filter
                if (filterColors.length) {
                    let groupColor = (group.color || "").replace("#", "").trim().toLowerCase();
                    if (!groupColor) continue;
                    if (groupColor.length === 3) {
                        groupColor = groupColor.replace(/(.)(.)(.)/, "$1$1$2$2$3$3");
                    }
                    groupColor = `#${groupColor}`;
                    if (!filterColors.includes(groupColor)) continue;
                }
                
                // Title filter
                const matchTitle = (this.properties[PROPERTY_MATCH_TITLE] || "").trim();
                if (matchTitle) {
                    try {
                        if (!new RegExp(matchTitle, "i").test(group.title)) continue;
                    } catch (e) {
                        console.error(e);
                        continue;
                    }
                }
                
                // showAllGraphs filter
                const showAllGraphs = this.properties[PROPERTY_SHOW_ALL_GRAPHS];
                if (!showAllGraphs && graph !== app.canvas.graph) {
                    continue;
                }
                
                filteredGroups.push(group);
            }

            // Update widgets - rgthreeのロジックを完全コピー
            // 固定ウィジェットの後から開始
            let index = this.fixedWidgetsCount || 0;
            for (const group of filteredGroups) {
                const title = group.title || "Group";
                const widgetName = `Enable: ${title}`;
                
                let widget = this.widgets ? this.widgets.find(w => w.name === widgetName) : null;
                
                if (!widget) {
                    // 新規ウィジェット作成
                    const isEnabled = isGroupEnabled.call(this, group);
                    widget = this.addWidget("toggle", widgetName, isEnabled, (v) => {});
                    if (widget) {
                        widget.callback = (v) => handleToggle.call(this, group, v, widget);
                    }
                } else {
                    // 既存ウィジェットのcallback更新
                    widget.callback = (v) => handleToggle.call(this, group, v, widget);
                }
                
                // ウィジェットの位置を正しいインデックスに移動 - rgthreeの重要なロジック
                if (widget && this.widgets[index] !== widget) {
                    const oldIndex = this.widgets.findIndex(w => w === widget);
                    if (oldIndex !== -1) {
                        this.widgets.splice(index, 0, this.widgets.splice(oldIndex, 1)[0]);
                    }
                }
                
                index++;
            }
            
            // index以降の余分なウィジェットを削除
            // removeWidgetはwidgetオブジェクトまたはindexを受け付けるが、安全のためwidgetオブジェクトを使用
            while ((this.widgets || [])[index]) {
                const widgetToRemove = this.widgets[index];
                if (widgetToRemove) {
                    this.removeWidget(widgetToRemove);
                } else {
                    break;
                }
            }

            console.log("[FastBypassV2] Filtered groups count:", filteredGroups.length);
            console.log("[FastBypassV2] Final index:", index);
            console.log("[FastBypassV2] Total widgets after update:", this.widgets ? this.widgets.length : 0);
            console.log("[FastBypassV2] Widget names:", this.widgets ? this.widgets.map(w => w.name) : []);

            // Resize
            if (index > 0) {
                this.setSize(this.computeSize());
            }
        };

        // Helper functions
        function getNodesInGroup(group) {
            const graph = app.graph;
            if (!graph) return [];
            const nodes = [];
            if (graph._nodes) {
                graph._nodes.forEach(n => {
                    if (!n.pos || !n.size) return;
                    const cx = n.pos[0] + n.size[0] / 2;
                    const cy = n.pos[1] + n.size[1] / 2;
                    if (cx >= group.pos[0] && cx <= group.pos[0] + group.size[0] &&
                        cy >= group.pos[1] && cy <= group.pos[1] + group.size[1]) {
                        nodes.push(n);
                    }
                });
            }
            return nodes;
        }

        function isGroupEnabled(group) {
            const nodes = getNodesInGroup(group);
            if (nodes.length === 0) return true;
            return nodes.some(n => n.mode === MODE_ALWAYS);
        }

        function setGroupMode(group, enable) {
            const graph = app.graph;
            if (!graph) return;
            
            const modeSetting = this.properties[PROPERTY_MODE];
            const modeOff = (modeSetting === "Mute") ? MODE_MUTE : MODE_BYPASS;
            const targetMode = enable ? MODE_ALWAYS : modeOff;
            
            const nodes = getNodesInGroup(group);
            let changed = false;
            nodes.forEach(n => {
                if (n.id !== this.id && n.mode !== targetMode) {
                    n.mode = targetMode;
                    changed = true;
                }
            });
            if (changed) graph.setDirtyCanvas(true, true);
        }

        function handleToggle(group, newValue, widget) {
            const restriction = this.properties[PROPERTY_RESTRICTION];
            
            if (newValue && (restriction === "max one" || restriction === "always one")) {
                if (this.widgets) {
                    this.widgets.forEach(w => {
                        if (w !== widget && w.type === "toggle" && w.name.startsWith("Enable: ") && w.value) {
                            w.value = false;
                        }
                    });
                }
                applyAllWidgets.call(this);
            } else if (!newValue && restriction === "always one") {
                const anyOn = this.widgets ? this.widgets.some(w => w.type === "toggle" && w.name.startsWith("Enable: ") && w.value) : false;
                if (!anyOn) {
                    widget.value = true;
                    newValue = true;
                }
            }

            setGroupMode.call(this, group, newValue);
            if (restriction !== "default") applyAllWidgets.call(this);
        }

        function applyAllWidgets() {
            const graph = app.graph;
            if (!graph) return;
            const groups = graph._groups || [];
            
            if (this.widgets) {
                this.widgets.forEach(w => {
                    if (w.type === "toggle" && w.name.startsWith("Enable: ")) {
                        const title = w.name.substring(8);
                        const g = groups.find(grp => (grp.title || "Group") === title);
                        if (g) setGroupMode.call(this, g, w.value);
                    }
                });
            }
        }

        // プロパティ変更時に即座にリフレッシュ
        node.onPropertyChanged = function(property, value) {
            if ([PROPERTY_MATCH_COLORS, PROPERTY_MATCH_TITLE, PROPERTY_SORT, PROPERTY_SORT_CUSTOM_ALPHA].includes(property)) {
                this.refreshWidgets();
            }
            if (property === PROPERTY_MODE) {
                const graph = app.graph;
                if (graph && this.widgets) {
                    this.widgets.forEach(w => {
                        if (w.type === "toggle" && w.name.startsWith("Enable: ")) {
                            const title = w.name.substring(8);
                            const g = (graph._groups || []).find(grp => (grp.title || "Group") === title);
                            if (g) setGroupMode.call(this, g, w.value);
                        }
                    });
                }
            }
            return true;
        };

        // 右クリックメニュー項目はbeforeRegisterNodeDefで追加済み

        // rgthreeと同じ: サービスに登録
        const origOnAdded = node.onAdded;
        node.onAdded = function(graph) {
            SERVICE.addNode(this);
            if (origOnAdded) origOnAdded.call(this, graph);
        };

        const origOnRemoved = node.onRemoved;
        node.onRemoved = function() {
            this.removed = true;
            SERVICE.removeNode(this);
            if (origOnRemoved) origOnRemoved.call(this);
        };

        // プロパティ編集用のボタンウィジェットを最初に追加（削除されないように）
        const editColorsBtn = node.addWidget("button", "🎨 Edit Match Colors", null, () => {
            const currentValue = node.properties[PROPERTY_MATCH_COLORS] || "";
            const newValue = prompt("Match Colors (comma separated, e.g. red,blue,#ff0000):", currentValue);
            if (newValue !== null) {
                node.properties[PROPERTY_MATCH_COLORS] = newValue;
                node.onPropertyChanged && node.onPropertyChanged(PROPERTY_MATCH_COLORS, newValue);
            }
        });
        
        const editTitleBtn = node.addWidget("button", "📝 Edit Match Title", null, () => {
            const currentValue = node.properties[PROPERTY_MATCH_TITLE] || "";
            const newValue = prompt("Match Title (regex pattern):", currentValue);
            if (newValue !== null) {
                node.properties[PROPERTY_MATCH_TITLE] = newValue;
                node.onPropertyChanged && node.onPropertyChanged(PROPERTY_MATCH_TITLE, newValue);
            }
        });
        
        // 固定ウィジェット数を記録（これらは削除しない）
        node.fixedWidgetsCount = node.widgets ? node.widgets.length : 0;

        // Initial
        setTimeout(() => {
            node.refreshWidgets();
            if (node.graph) {
                SERVICE.addNode(node);
            }
        }, 100);
    }
});
