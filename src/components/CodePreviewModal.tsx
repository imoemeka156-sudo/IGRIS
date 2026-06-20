import React, { useEffect, useMemo } from "react";

const supportedPreviewLanguages = new Set(["html", "htm", "css", "js", "javascript", "jsx", "tsx"]);

function isFullHtmlDocument(code: string) {
  return /<!doctype html|<html[\s>]/i.test(code);
}

function buildHtmlPreview(code: string) {
  if (isFullHtmlDocument(code)) {
    return code;
  }

  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style>html,body{margin:0;padding:0;min-height:100vh;background:#0f172a;color:#e2e8f0;font-family:system-ui, sans-serif;}</style>
  </head>
  <body>
    ${code}
  </body>
</html>`;
}

function extractClassesFromCss(css: string): string[] {
  const classRegex = /\.([a-zA-Z_-][a-zA-Z0-9_-]*)/g;
  const classes = new Set<string>();
  let match;
  while ((match = classRegex.exec(css)) !== null) {
    classes.add(match[1]);
  }
  return Array.from(classes);
}

function buildCssPreview(code: string) {
  const classSelectors = extractClassesFromCss(code);
  const testElements = classSelectors
    .slice(0, 8)
    .map((cls) => `<div class="${cls}" style="margin:0.75rem 0;padding:1rem;border:1px solid rgba(255,255,255,0.1);border-radius:0.375rem;">${cls}</div>`)
    .join("");

  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style>${code}</style>
    <style>html,body{margin:0;padding:0;background:#0f172a;color:#e2e8f0;font-family:system-ui, sans-serif;} body{padding:2rem;} .css-header{margin-bottom:2rem;} .css-header h1{margin:0 0 0.5rem 0;font-size:1.5rem;} .css-header p{margin:0;color:#a1a1a1;font-size:0.9rem;}</style>
  </head>
  <body>
    <div class="css-header">
      <h1>CSS Preview</h1>
      <p>Your stylesheet has been applied. Below are test elements using your custom classes:</p>
    </div>
    <div style="max-width:900px;">
      ${testElements || '<div style="padding:2rem;text-align:center;color:#666;">No CSS classes found. Add classes to your CSS to see them rendered here.</div>'}
    </div>
  </body>
</html>`;
}

function buildJsPreview(code: string) {
  const userCode = JSON.stringify(code);
  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style>html,body{margin:0;padding:0;background:#0f172a;color:#e2e8f0;font-family:system-ui, sans-serif;} .igris-js-error{padding:1.25rem;white-space:pre-wrap;line-height:1.5;color:#fca5a5;background:#111827;border:1px solid #f87171;border-radius:.75rem;max-width:100%;box-sizing:border-box;}</style>
  </head>
  <body>
    <div id="preview-root"></div>
    <script>
      function showError(message) {
        document.body.innerHTML = '<div class="igris-js-error">Preview Error\n' + message + '</div>';
      }
      try {
        const code = ${userCode};
        const fn = new Function(code);
        fn();
      } catch (error) {
        showError(error && error.message ? error.message : String(error));
      }
    </script>
  </body>
</html>`;
}

function stripReactImports(code: string) {
  return code.replace(/^\s*import\s.+from\s+['"][^'"]*['"];?\s*$/gm, "");
}

function normalizeReactCode(code: string) {
  let transformed = stripReactImports(code).trim();

  const exportDefaultFn = /export\s+default\s+function\s+([A-Za-z_$][A-Za-z0-9_$]*)\s*\(/;
  const exportDefaultClass = /export\s+default\s+class\s+([A-Za-z_$][A-Za-z0-9_$]*)/;
  const exportDefaultExpression = /export\s+default\s+([\s\S]+);?$/;

  if (exportDefaultFn.test(transformed)) {
    transformed = transformed.replace(exportDefaultFn, "function $1(");
    transformed += "\nwindow.__IGRIS_PREVIEW__ = $1;";
  } else if (exportDefaultClass.test(transformed)) {
    transformed = transformed.replace(exportDefaultClass, "class $1");
    transformed += "\nwindow.__IGRIS_PREVIEW__ = $1;";
  } else if (exportDefaultExpression.test(transformed)) {
    transformed = transformed.replace(exportDefaultExpression, "window.__IGRIS_PREVIEW__ = $1;");
  }

  if (!/ReactDOM\.(createRoot|render)\(/.test(transformed)) {
    if (/^\s*</.test(transformed)) {
      transformed = `const PreviewComponent = () => (${transformed});\nwindow.__IGRIS_PREVIEW__ = PreviewComponent;`;
    } else if (!/window\.__IGRIS_PREVIEW__/.test(transformed)) {
      transformed += "\nwindow.__IGRIS_PREVIEW__ = typeof App !== 'undefined' ? App : typeof PreviewComponent !== 'undefined' ? PreviewComponent : undefined;";
    }
  }

  return transformed;
}

function buildReactPreview(code: string) {
  const escapedCode = normalizeReactCode(code);
  const userCode = JSON.stringify(escapedCode);

  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <script crossorigin src="https://unpkg.com/react@18/umd/react.development.js"><\/script>
    <script crossorigin src="https://unpkg.com/react-dom@18/umd/react-dom.development.js"><\/script>
    <script src="https://unpkg.com/@babel/standalone@7.23.5/babel.min.js"><\/script>
    <style>html,body{margin:0;padding:0;min-height:100vh;background:#0f172a;color:#e2e8f0;font-family:system-ui, sans-serif;} .igris-react-error{padding:1.5rem;white-space:pre-wrap;line-height:1.5;color:#fca5a5;background:#111827;border:1px solid #f87171;border-radius:.75rem;}</style>
  </head>
  <body>
    <div id="root" style="min-height:100vh;"><\/div>
    <div id="igris-error"><\/div>
    <script>
      function showError(message) {
        const target = document.getElementById('igris-error');
        if (target) {
          target.innerHTML = '<div class="igris-react-error">Preview Error<br>' + String(message) + '<\/div>';
        }
      }
      try {
        const code = ${userCode};
        const transformed = Babel.transform(code, { 
          filename: 'preview.tsx',
          presets: [
            ['react', { runtime: 'automatic' }],
            'typescript'
          ]
        }).code;
        eval(transformed);
        const root = document.getElementById('root');
        if (typeof window.__IGRIS_PREVIEW__ === 'function') {
          ReactDOM.createRoot(root).render(React.createElement(window.__IGRIS_PREVIEW__));
        }
      } catch (error) {
        showError(error && error.message ? error.message : String(error));
      }
    <\/script>
  </body>
</html>`;
}

export function buildPreviewDoc(code: string, language: string) {
  const lang = (language || "").toLowerCase().trim();
  if (!supportedPreviewLanguages.has(lang)) {
    return null;
  }

  if (lang === "html" || lang === "htm") {
    return buildHtmlPreview(code);
  }

  if (lang === "css") {
    return buildCssPreview(code);
  }

  if (lang === "js" || lang === "javascript") {
    return buildJsPreview(code);
  }

  if (lang === "jsx" || lang === "tsx") {
    return buildReactPreview(code);
  }

  return null;
}

interface CodePreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  code: string;
  language: string;
  previewKey: number;
}

export default function CodePreviewModal({ isOpen, onClose, code, language, previewKey }: CodePreviewModalProps) {
  const srcDoc = useMemo(() => buildPreviewDoc(code, language), [code, language]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [isOpen, onClose]);

  if (!isOpen) {
    return null;
  }

  const previewError = srcDoc === null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
      <div className="relative mx-auto flex h-full w-full max-w-6xl flex-col overflow-hidden rounded-3xl border border-white/10 bg-zinc-950 shadow-2xl">
        <div className="flex items-center justify-between border-b border-white/10 bg-zinc-900/80 px-5 py-4">
          <div>
            <div className="text-sm font-semibold text-white">Code Preview</div>
            <div className="text-[10px] uppercase tracking-[0.25em] text-zinc-400">{language.toUpperCase()}</div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-white/10 bg-zinc-900/80 px-3 py-2 text-sm font-semibold text-zinc-200 transition hover:bg-white/5"
          >
            Close
          </button>
        </div>

        {previewError ? (
          <div className="flex h-full items-center justify-center p-8 text-sm text-red-300">
            Preview unavailable for this language.
          </div>
        ) : (
          <iframe
            key={previewKey}
            title="igris-code-preview"
            sandbox="allow-scripts allow-same-origin"
            srcDoc={srcDoc || ""}
            className="h-full w-full border-0 bg-black"
            style={{ minHeight: "520px" }}
          />
        )}
      </div>
    </div>
  );
}
