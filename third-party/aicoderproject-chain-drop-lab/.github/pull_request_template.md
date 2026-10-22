## Summary (PRの概要)
変更内容やバグ修正の要約を記載してください。

## Changes (変更内容)
- [ ] 変更点1
- [ ] 変更点2

## Testing (動作検証結果)
どのような検証を行ったかを記載してください。
- [ ] `npm run verify` がすべてパスすることを確認

## Screenshots (スクリーンショット)
UIや演出の変更がある場合は、変更後のスクリーンショットやアニメーションGIFを貼り付けてください。

## Checklist (チェックリスト)
PRを作成する前に、以下の項目にすべてチェックが入っていることを確認してください。

- [ ] **No Third-Party Assets**: 第三者の著作画像（png, jpg等）や音声ファイル（mp3, wav等）を追加していないこと。（すべてCanvas描画およびWeb Audio APIの動的生成を厳守しています）
- [ ] **No Secrets**: APIキー、個人トークン、パスワードなどの機密情報がハードコードされていないこと。
- [ ] **No Trademark Risk**: 「ぷよぷよ」などの商標権や知的財産権を侵害する名称・アセットを追加していないこと。
- [ ] **Type-Safe**: TypeScriptコンパイルが正常に通ること。
- [ ] **Lint Clean**: ESLintおよびPrettierによるエラーや警告が0件であること。
- [ ] **Tests Pass**: `npm run test` で全ユニットテストが正常にパスすること。
