# ComfyUI-NunchakuFluxLoraStacker

Nunchaku FLUX モデル専用の高度なLoRAスタッカーノードです。動的UI制御により、使いやすく効率的なLoRA管理を実現します。

## 概要

このプロジェクトは、[Nunchaku](https://github.com/nunchaku-tech/ComfyUI-nunchaku)の標準装備のFLUX用LoRA Stackerの使い勝手を改善するために開発されました。efficiency-nodes-comfyuiやPower LoRA Loaderと同じような、LoRA数の増減に合わせての縦幅伸縮機能を持たせた上で、完全に独立したCustom Nodesとして切り分けています。

Nunchaku本体の更新と共に機能が消えてしまうことを防ぎ、独立したメンテナンスを可能にしています。

## 主要機能

### 動的UI制御
- **LoRA数に応じた自動調整**: `lora_count`パラメータの値に応じて、表示されるLoRAスロット数が自動的に変化
- **ノード高さの自動調整**: 表示中のウィジェット数に合わせて、ノードの高さが動的に変化
- **リアルタイム更新**: パラメータ変更時に即座にUIが更新

### 2つの入力モード
- **Simple Mode（シンプルモード）**: 
  - LoRA名と全体の強度（weight）のみを表示
  - 素早く設定したい場合に最適
  
- **Advanced Mode（アドバンスドモード）**:
  - Model強度とCLIP強度を個別に設定可能
  - より細かい制御が必要な場合に使用

### 最大10個のLoRA同時適用
- 1つのノードで最大10個のLoRAを同時に適用可能
- 使用しないスロットは`None`を選択することでスキップ
- `lora_count`で処理するLoRA数を制限し、パフォーマンスを最適化

### Nunchaku専用最適化
- **量子化モデル対応**: Nunchakuの4bit量子化モデルに完全対応
- **torch.compile()対応**: OptimizedModuleをサポート
- **PuLID統合**: PuLIDパイプラインとの互換性を保持
- **ControlNet対応**: ControlNet-Union-Pro 2.0などと併用可能
- **First-Block Cache**: Nunchakuのキャッシング機能をサポート

## 技術的特徴

### Python + JavaScript ハイブリッド実装
このノードはPythonだけでは実現できない高度な機能を提供します：

1. **Python側（nodes/lora/flux.py）**:
   - Nunchaku FLUXモデルへのLoRA適用ロジック
   - ComfyFluxWrapperとの統合
   - LoRA合成処理
   - PuLID重みの保存・復元
   - input_channels自動調整

2. **Wrapper（wrappers/flux.py）**:
   - NunchakuFluxTransformer2dModelのラッパー
   - LoRA合成とモデル更新
   - キャッシング戦略の実装
   - PuLIDとControlNetのサポート

3. **JavaScript側（js/widgethider.js）**:
   - 動的ウィジェット表示/非表示制御
   - ノード高さの自動計算と調整
   - efficiency-nodes-comfyuiスタイルのUI制御

## インストール

1. ComfyUIの`custom_nodes`ディレクトリにクローンします：
```bash
cd ComfyUI/custom_nodes
git clone https://github.com/ussoewwin/ComfyUI-NunchakuFluxLoraStacker.git
```

2. 依存関係をインストールします：
```bash
cd ComfyUI-NunchakuFluxLoraStacker
pip install -r requirements.txt
```

3. ComfyUIを再起動します

## 使い方

### 基本的な使い方

1. ワークフローに**FLUX LoRA Multi Loader**ノードを追加
2. `model`入力にNunchaku FLUX モデルを接続
3. `lora_count`で使用するLoRAスロット数を設定（1-10）
4. `input_mode`を選択：
   - **simple**: 全体的な強度のみを調整
   - **advanced**: ModelとCLIPを個別に調整
5. 各スロットでLoRAファイルを選択し、強度を設定
6. 出力を次のノードに接続

### パラメータ詳細

#### 必須入力
- **model**: Nunchaku FLUX モデル（`Nunchaku FLUX DiT Loader`から）
- **input_mode**: 入力モード（`simple` / `advanced`）
- **lora_count**: 処理するLoRAスロット数（1-10）

#### LoRAスロット（各スロットごと）
- **lora_name_X**: LoRAファイル名（`None`でスキップ）
- **lora_wt_X**: 全体強度（Simple Mode、-100.0～100.0）
- **model_str_X**: Model強度（Advanced Mode、-100.0～100.0）
- **clip_str_X**: CLIP強度（Advanced Mode、-100.0～100.0）

### UI動作

ノードは以下の場合に自動的にUIを更新します：
- `lora_count`を変更した時 → 表示されるLoRAスロット数が変化
- `input_mode`を変更した時 → 表示される強度パラメータが切り替わり
- 両方の変更に応じて、ノードの高さが自動調整されます

## 動作要件

- ComfyUI
- Nunchaku FLUX モデル（量子化済み）
- nunchaku >= 1.0.0
- Nunchaku FLUX互換のLoRAファイル

## 技術詳細

### LoRA合成処理
複数のLoRAを単一のstate_dictに合成してから適用することで、効率的な処理を実現しています。

### PuLID互換性
LoRA更新時にPuLIDの重みを保存し、更新後に復元することで、PuLIDとの互換性を維持しています。

### torch.compile対応
`OptimizedModule`でラップされたモデルを適切に処理し、`_orig_mod`から実際のモデルにアクセスします。

### input_channels自動調整
LoRAに含まれる`x_embedder.lora_A.weight`から必要なinput_channelsを自動検出し、モデル設定を更新します。

## ライセンス

Apache-2.0

## クレジット

- 動的UI制御の実装は[efficiency-nodes-comfyui](https://github.com/jags111/efficiency-nodes-comfyui)を参考にしています
- [Nunchaku](https://github.com/nunchaku-tech/ComfyUI-nunchaku)プロジェクトとの統合を前提に開発されています

## 参考リンク

- [Nunchaku公式リポジトリ](https://github.com/nunchaku-tech/ComfyUI-nunchaku)
- [Nunchaku公式ドキュメント](https://nunchaku.tech/docs/ComfyUI-nunchaku/)
- [DeepCompressor（量子化ライブラリ）](https://github.com/mit-han-lab/deepcompressor)

## 開発背景

Nunchakuの標準LoRA Stackerは取り回しが良くないため、efficiency-nodes-comfyuiのような縦幅伸縮機能を持つ、使いやすいインターフェースとして再実装しました。独立したCustom Nodeとして切り分けることで、Nunchaku本体の更新に影響されず、安定した運用が可能になります。

このコードはPythonだけでなくJavaScriptも使用した高難易度の実装となっており、Python側からウィジェット機能を実装したJavaScriptを読み込ませるロジックが必要です。
