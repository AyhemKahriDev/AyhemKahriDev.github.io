import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

const STORAGE_KEY = 'cursorArcade.v1';

type GameId = 'snake' | 'twenty48' | 'blocks' | 'sweeper' | 'soccer' | 'capitalist' | 'pong' | 'tictactoe';

interface ArcadeStorage {
  highScores: Record<string, number>;
  settings: Record<string, unknown>;
}

export function activate(context: vscode.ExtensionContext) {
  const open = (opts: { game?: GameId; daily?: boolean } = {}) => {
    ArcadePanel.createOrShow(context, opts);
  };

  const commands: Array<[string, () => void]> = [
    ['cursor-arcade.open', () => open()],
    ['cursor-arcade.snake', () => open({ game: 'snake' })],
    ['cursor-arcade.twenty48', () => open({ game: 'twenty48' })],
    ['cursor-arcade.blocks', () => open({ game: 'blocks' })],
    ['cursor-arcade.sweeper', () => open({ game: 'sweeper' })],
    ['cursor-arcade.soccer', () => open({ game: 'soccer' })],
    ['cursor-arcade.capitalist', () => open({ game: 'capitalist' })],
    ['cursor-arcade.pong', () => open({ game: 'pong' })],
    ['cursor-arcade.tictactoe', () => open({ game: 'tictactoe' })],
    ['cursor-arcade.dailyChallenge', () => open({ game: 'snake', daily: true })],
  ];

  for (const [id, fn] of commands) {
    context.subscriptions.push(vscode.commands.registerCommand(id, fn));
  }

  context.subscriptions.push(
    vscode.commands.registerCommand('cursor-arcade.resetHighScores', async () => {
      const storage = readStorage(context);
      storage.highScores = {};
      await writeStorage(context, storage);
      vscode.window.showInformationMessage('Cursor Arcade: all high scores cleared.');
      ArcadePanel.current?.postMessage({ type: 'storage', storage });
    }),
  );
}

export function deactivate() {}

function readStorage(context: vscode.ExtensionContext): ArcadeStorage {
  const stored = context.globalState.get<ArcadeStorage>(STORAGE_KEY);
  if (stored && typeof stored === 'object') {
    return {
      highScores: stored.highScores ?? {},
      settings: stored.settings ?? {},
    };
  }
  return { highScores: {}, settings: {} };
}

function writeStorage(context: vscode.ExtensionContext, storage: ArcadeStorage) {
  return context.globalState.update(STORAGE_KEY, storage);
}

class ArcadePanel {
  public static current: ArcadePanel | undefined;
  private static readonly viewType = 'cursorArcade';

  private readonly panel: vscode.WebviewPanel;
  private readonly context: vscode.ExtensionContext;
  private disposables: vscode.Disposable[] = [];

  public static createOrShow(
    context: vscode.ExtensionContext,
    opts: { game?: GameId; daily?: boolean },
  ) {
    const column = vscode.window.activeTextEditor?.viewColumn ?? vscode.ViewColumn.One;

    if (ArcadePanel.current) {
      ArcadePanel.current.panel.reveal(column);
      if (opts.game) {
        ArcadePanel.current.postMessage({
          type: 'navigate',
          game: opts.game,
          daily: !!opts.daily,
        });
      }
      return;
    }

    const mediaRoot = vscode.Uri.file(path.join(context.extensionPath, 'media'));
    const panel = vscode.window.createWebviewPanel(
      ArcadePanel.viewType,
      'Cursor Arcade',
      column,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [mediaRoot],
      },
    );

    ArcadePanel.current = new ArcadePanel(panel, context, opts);
  }

  private constructor(
    panel: vscode.WebviewPanel,
    context: vscode.ExtensionContext,
    opts: { game?: GameId; daily?: boolean },
  ) {
    this.panel = panel;
    this.context = context;

    this.panel.webview.html = this.buildHtml();
    this.panel.iconPath = this.buildIconUri();

    this.panel.onDidDispose(() => this.dispose(), null, this.disposables);
    this.panel.webview.onDidReceiveMessage(
      (msg) => void this.onMessage(msg),
      null,
      this.disposables,
    );

    this.postMessage({
      type: 'hydrate',
      storage: readStorage(this.context),
      nav: { game: opts.game ?? null, daily: !!opts.daily },
    });
  }

  public postMessage(message: unknown) {
    void this.panel.webview.postMessage(message);
  }

  private async onMessage(msg: unknown): Promise<void> {
    if (!msg || typeof msg !== 'object') return;
    const m = msg as Record<string, unknown>;
    const storage = readStorage(this.context);

    switch (m.type) {
      case 'submitScore': {
        const key = String(m.key ?? '');
        const score = Math.max(0, Math.floor(Number(m.score) || 0));
        if (!key) return;
        if (!storage.highScores[key] || score > storage.highScores[key]) {
          storage.highScores[key] = score;
          await writeStorage(this.context, storage);
          this.postMessage({ type: 'storage', storage });
        }
        return;
      }
      case 'saveSettings': {
        const game = String(m.game ?? 'global');
        storage.settings[game] = m.settings ?? null;
        await writeStorage(this.context, storage);
        return;
      }
      case 'requestStorage': {
        this.postMessage({ type: 'storage', storage });
        return;
      }
      case 'resetHighScores': {
        storage.highScores = {};
        await writeStorage(this.context, storage);
        this.postMessage({ type: 'storage', storage });
        return;
      }
      case 'toast': {
        vscode.window.showInformationMessage(String(m.message ?? ''));
        return;
      }
    }
  }

  private buildIconUri() {
    const file = vscode.Uri.file(path.join(this.context.extensionPath, 'media', 'icon.svg'));
    return { light: file, dark: file };
  }

  private buildHtml(): string {
    const webview = this.panel.webview;
    const mediaPath = path.join(this.context.extensionPath, 'media');
    const htmlPath = path.join(mediaPath, 'index.html');

    const styleUri = webview.asWebviewUri(vscode.Uri.file(path.join(mediaPath, 'arcade.css')));
    const arcadeJsUri = webview.asWebviewUri(vscode.Uri.file(path.join(mediaPath, 'arcade.js')));
    const snakeUri = webview.asWebviewUri(
      vscode.Uri.file(path.join(mediaPath, 'games', 'snake.js')),
    );
    const twenty48Uri = webview.asWebviewUri(
      vscode.Uri.file(path.join(mediaPath, 'games', 'twenty48.js')),
    );
    const blocksUri = webview.asWebviewUri(
      vscode.Uri.file(path.join(mediaPath, 'games', 'blocks.js')),
    );
    const sweeperUri = webview.asWebviewUri(
      vscode.Uri.file(path.join(mediaPath, 'games', 'sweeper.js')),
    );
    const soccerUri = webview.asWebviewUri(
      vscode.Uri.file(path.join(mediaPath, 'games', 'soccer.js')),
    );
    const capitalistUri = webview.asWebviewUri(
      vscode.Uri.file(path.join(mediaPath, 'games', 'capitalist.js')),
    );
    const pongUri = webview.asWebviewUri(
      vscode.Uri.file(path.join(mediaPath, 'games', 'pong.js')),
    );
    const tictactoeUri = webview.asWebviewUri(
      vscode.Uri.file(path.join(mediaPath, 'games', 'tictactoe.js')),
    );

    const nonce = makeNonce();
    const csp =
      `default-src 'none'; ` +
      `img-src ${webview.cspSource} data: blob:; ` +
      `style-src ${webview.cspSource} 'unsafe-inline'; ` +
      `script-src 'nonce-${nonce}'; ` +
      `font-src ${webview.cspSource};`;

    let html = fs.readFileSync(htmlPath, 'utf8');
    html = html
      .replace(/{{cspSource}}/g, webview.cspSource)
      .replace(/{{csp}}/g, csp)
      .replace(/{{nonce}}/g, nonce)
      .replace(/{{styleUri}}/g, styleUri.toString())
      .replace(/{{arcadeJsUri}}/g, arcadeJsUri.toString())
      .replace(/{{snakeUri}}/g, snakeUri.toString())
      .replace(/{{twenty48Uri}}/g, twenty48Uri.toString())
      .replace(/{{blocksUri}}/g, blocksUri.toString())
      .replace(/{{sweeperUri}}/g, sweeperUri.toString())
      .replace(/{{soccerUri}}/g, soccerUri.toString())
      .replace(/{{capitalistUri}}/g, capitalistUri.toString())
      .replace(/{{pongUri}}/g, pongUri.toString())
      .replace(/{{tictactoeUri}}/g, tictactoeUri.toString());

    return html;
  }

  public dispose() {
    ArcadePanel.current = undefined;
    this.panel.dispose();
    while (this.disposables.length) {
      const d = this.disposables.pop();
      d?.dispose();
    }
  }
}

function makeNonce(): string {
  let text = '';
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < 32; i++) {
    text += alphabet.charAt(Math.floor(Math.random() * alphabet.length));
  }
  return text;
}
