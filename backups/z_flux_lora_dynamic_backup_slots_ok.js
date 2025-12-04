import { app } from "../../scripts/app.js";

console.log("★★★ z_flux_lora_dynamic.js: FORCE TYPE RESTORE & MANUAL HEIGHT ★★★");

const HIDDEN_TAG = "tschide";

// 復元すべき正しい型をハードコード定義（origPropsに頼らない）
const WIDGET_TYPES = {
    "lora_name": "combo",
    "lora_wt": "number"
};

app.registerExtension({
    name: "nunchaku.flux_lora_dynamic_restore",
    
    async beforeRegisterNodeDef(nodeType, nodeData, app) {
        if (nodeData.name === "FluxLoraMultiLoader_10") {
            nodeType["@visibleLoraCount"] = { type: "number", default: 1, min: 1, max: 10, step: 1 };
        }
    },

    nodeCreated(node) {
        if (node.comfyClass !== "FluxLoraMultiLoader_10") return;

        // 状態保存トラブルの元凶を断つ
        node.serialize_widgets = false;

        if (!node.properties) node.properties = {};
        if (node.properties["visibleLoraCount"] === undefined) node.properties["visibleLoraCount"] = 1;

        node.updateLoraSlots = function() {
            const count = parseInt(this.properties["visibleLoraCount"] || 1);
            
            // 1. ウィジェットの表示/非表示を強制設定
            // 1～10まで全て走査し、count以下なら「正規の型」に、それ以外なら「HIDDEN」にする
            for (let i = 1; i <= 10; i++) {
                const isVisible = i <= count;
                
                // 名前 (combo) と 重み (number)
                ["lora_name", "lora_wt"].forEach(prefix => {
                    const wName = `${prefix}_${i}`;
                    const w = this.widgets.find(x => x.name === wName);
                    if (w) {
                        if (isVisible) {
                            // ★重要: origPropsは見ず、必ず正しい型で上書きする
                            // これにより「以前隠れていたからHIDDENに戻る」事故を防ぐ
                            w.type = WIDGET_TYPES[prefix];
                            
                            // computeSizeも標準に戻す（特に指定しなければデフォルトが使われる）
                            // 前回の変更でcomputeSizeを上書きしていた場合の解除
                            if (w.computeSize && w.computeSize.toString().includes("return [0, -4]")) {
                                delete w.computeSize; 
                            }
                        } else {
                            w.type = HIDDEN_TAG;
                            // 高さを潰す
                            w.computeSize = () => [0, -4];
                        }
                    }
                });
            }

            // 2. ノードの高さ手動計算
            // ヘッダー + ボタン + (スロット数 * 高さ)
            // LiteGraphの標準的な高さ: ヘッダー~30, ボタン~30, 各ウィジェット~26
            // スロットあたり: 名前(26) + 重み(26) + マージン = 約54px
            const HEADER_H = 60; // ボタン含む
            const SLOT_H = 54; 
            const PADDING = 20;
            
            const targetH = HEADER_H + (count * SLOT_H) + PADDING;
            
            this.setSize([this.size[0], targetH]);
            
            if (app.canvas) app.canvas.setDirty(true, true);
        };

        // ボタン追加
        const btnName = "🔢 Set LoRA Count";
        // 重複防止
        let btn = node.widgets.find(w => w.name === btnName);
        if (!btn) {
            btn = node.addWidget("button", btnName, null, () => {
                const current = node.properties["visibleLoraCount"];
                const val = prompt("Enter LoRA Count (1-10):", current);
                if (val !== null) {
                    const num = parseInt(val);
                    if (!isNaN(num) && num >= 1 && num <= 10) {
                        node.properties["visibleLoraCount"] = num;
                        node.updateLoraSlots();
                    }
                }
            });
        }
        
        // ボタンを先頭へ移動（常に）
        const btnIdx = node.widgets.indexOf(btn);
        if (btnIdx > 0) {
            node.widgets.splice(0, 0, node.widgets.splice(btnIdx, 1)[0]);
        }
        
        // コールバック再設定（再読み込み対策）
        btn.callback = () => {
            const current = node.properties["visibleLoraCount"];
            const val = prompt("Enter LoRA Count (1-10):", current);
            if (val !== null) {
                const num = parseInt(val);
                if (!isNaN(num) && num >= 1 && num <= 10) {
                    node.properties["visibleLoraCount"] = num;
                    node.updateLoraSlots();
                }
            }
        };

        node.onPropertyChanged = function(property, value) {
            if (property === "visibleLoraCount") {
                this.updateLoraSlots();
            }
        };

        // 初回実行
        setTimeout(() => node.updateLoraSlots(), 100);
    }
});
