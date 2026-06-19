const { Plugin, TFile } = require('obsidian');

/**
 * Inline Rename for Obsidian
 * Click an already-active file in the explorer to rename it inline.
 */
const InlineRenamePlugin = class extends Plugin {
    async onload() {
        this.activeFilePath = null;
        this.activeFileSetAt = 0;
        this.isRenaming = false;
        this.renamingPath = null;

        // Track active file
        const self = this;
        this.registerEvent(
            this.app.workspace.on('active-leaf-change', function () {
                const file = self.app.workspace.getActiveFile();
                const newPath = file ? file.path : null;
                self.activeFilePath = newPath;
                self.activeFileSetAt = Date.now();

                if (self.isRenaming && newPath !== self.renamingPath) {
                    self.isRenaming = false;
                    self.renamingPath = null;
                }
            })
        );

        // Capture clicks
        document.addEventListener('click', function (evt) {
            if (self.isRenaming) return;

            const target = evt.target;

            // New Obsidian: .tree-item-self.nav-file-title
            // Legacy Obsidian: .nav-file-title
            const titleRow =
                target.closest('.tree-item-self.nav-file-title') ||
                target.closest('.nav-file-title');
            if (!titleRow) return;

            // Container for data-path
            const container =
                titleRow.closest('.tree-item') ||
                titleRow.closest('.nav-file');
            if (!container) return;

            // Resolve file
            const file = self.resolveFile(container, titleRow);
            if (!file) return;

            // Must be active file
            if (file.path !== self.activeFilePath) return;

            // Cooldown (>650ms since file became active)
            if (Date.now() - self.activeFileSetAt < 650) return;

            // Trigger!
            evt.preventDefault();
            evt.stopPropagation();
            evt.stopImmediatePropagation();

            self.startRename(titleRow, file);
        }, true);

        this.register(function () {
            // cleanup handled by Obsidian
        });

        console.log('[ARA] loaded. Active:', (this.app.workspace.getActiveFile() || {}).path || 'none');
    }

    resolveFile(container, titleRow) {
        // Walk up from titleRow looking for data-path
        var el = titleRow;
        while (el) {
            var p = el.getAttribute('data-path') || (el.dataset && el.dataset.path);
            if (p) {
                var f = this.app.vault.getAbstractFileByPath(p);
                if (f instanceof TFile) {
                    console.log('[ARA] resolved via data-path:', p);
                    return f;
                }
                console.log('[ARA] data-path found but not in vault:', p);
            }
            el = el.parentElement;
        }

        // Fallback: name match
        var textEl = titleRow.querySelector('.tree-item-inner') || titleRow.querySelector('.nav-file-title-content');
        var name = (textEl && textEl.textContent || titleRow.textContent || '').trim();
        if (!name) return null;

        var files = this.app.vault.getFiles();
        return files.find(function (f) { return f.name === name; })
            || files.find(function (f) { return f.path === name; })
            || files.find(function (f) { return f.path.endsWith('/' + name); })
            || null;
    }

    startRename(titleRow, file) {
        var self = this;
        this.isRenaming = true;
        this.renamingPath = file.path;

        var original = file.name;
        var ext = file.extension ? '.' + file.extension : '';
        var base = ext ? original.slice(0, -ext.length) : original;

        // Find text element
        var textEl = titleRow.querySelector('.tree-item-inner') || titleRow.querySelector('.nav-file-title-content');
        if (!textEl) return;

        textEl.style.display = 'none';

        // Create input
        var input = document.createElement('input');
        input.type = 'text';
        input.value = original;
        input.className = 'inline-rename-input';
        input.setAttribute('style',
            'position:relative;z-index:10;width:100%;height:24px;line-height:24px;' +
            'padding:0 6px;margin:0;border:1.5px solid var(--interactive-accent);' +
            'border-radius:4px;font-family:inherit;font-size:inherit;' +
            'color:var(--text-normal);background:var(--background-primary);' +
            'outline:none;box-sizing:border-box;'
        );

        input.addEventListener('click', function (e) { e.stopPropagation(); });
        input.addEventListener('mousedown', function (e) { e.stopPropagation(); });

        titleRow.appendChild(input);

        if (base && base.length > 0) {
            input.setSelectionRange(0, base.length);
        } else {
            input.select();
        }

        requestAnimationFrame(function () { input.focus(); });

        var hasCommitted = false;

        function cleanup() {
            if (input.parentNode) input.remove();
            textEl.style.display = '';
            self.isRenaming = false;
            self.renamingPath = null;
        }

        function finishRename(newNameRaw) {
            if (hasCommitted) return;
            hasCommitted = true;

            var newName = newNameRaw.trim();
            cleanup();

            if (!newName || newName === original) return;

            var finalName = newName;
            if (ext && finalName.indexOf(ext) !== finalName.length - ext.length) {
                finalName = finalName + ext;
            }

            var dirPath = file.path.slice(0, -original.length);
            var newPath = dirPath + finalName;

            self.app.vault.rename(file, newPath).then(function () {
                console.log('[ARA] renamed: ' + original + ' -> ' + finalName);
            }).catch(function (err) {
                console.error('[ARA] rename failed', err);
            });
        }

        input.addEventListener('blur', function () {
            setTimeout(function () { finishRename(input.value); }, 100);
        });

        input.addEventListener('keydown', function (e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                finishRename(input.value);
            } else if (e.key === 'Escape') {
                e.preventDefault();
                input.value = original;
                hasCommitted = true;
                cleanup();
            }
        });
    }

    onunload() {
        console.log('[ARA] unloaded');
    }
};

module.exports = InlineRenamePlugin;
