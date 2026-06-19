import { Plugin, TFile, WorkspaceLeaf } from "obsidian";

/**
 * ARA — click to rename in Obsidian, just like Windows File Explorer.
 *
 * Inline Rename Plugin for Obsidian
 *
 * Simulates Windows File Explorer behavior:
 *   - Click an inactive file → opens it (default Obsidian behavior)
 *   - Single-click the already-active file's name in the explorer → inline rename
 *
 * Supports both legacy (.nav-file-title-content) and new tree-item (.tree-item-self)
 * Obsidian file explorer DOM structures.
 */
export default class InlineRenamePlugin extends Plugin {
    private activeFilePath: string | null = null;
    private activeFileSetAt: number = 0;
    private isRenaming: boolean = false;
    private renamingPath: string | null = null;

    async onload() {
        // ── Track active file changes ──────────────────────────────
        this.registerEvent(
            this.app.workspace.on("active-leaf-change", (_leaf: WorkspaceLeaf | null) => {
                const file = this.app.workspace.getActiveFile();
                const newPath = file?.path ?? null;

                this.activeFilePath = newPath;
                this.activeFileSetAt = Date.now();

                // If navigated away while renaming, cancel
                if (this.isRenaming && newPath !== this.renamingPath) {
                    this.cancelRename();
                }
            })
        );

        // ── Intercept clicks in capture phase ──────────────────────
        // raw addEventListener ensures capture:true works correctly
        document.addEventListener("click", this.onClick, true);
        this.register(() => {
            document.removeEventListener("click", this.onClick, true);
        });

        console.log("[InlineRename] loaded. Active file:", this.app.workspace.getActiveFile()?.path ?? "(none)");
    }

    onunload() {
        console.log("[InlineRename] unloaded");
    }

    // ── Click handler (capture phase) ─────────────────────────────

    private onClick = (evt: MouseEvent) => {
        if (this.isRenaming) return;

        const target = evt.target as HTMLElement;

        // ── Find the file title row we clicked on ──────────────────
        // New Obsidian: .tree-item-self.nav-file-title
        // Legacy Obsidian: .nav-file-title (inside .nav-file)
        const titleRow = target.closest(".tree-item-self.nav-file-title") as HTMLElement | null
            ?? target.closest(".nav-file-title") as HTMLElement | null;
        if (!titleRow) return;

        // ── Find the container that holds data-path ────────────────
        // New Obsidian: parent .tree-item or ancestor .nav-file
        // Legacy: ancestor .nav-file
        const container = titleRow.closest(".tree-item") as HTMLElement | null
            ?? titleRow.closest(".nav-file") as HTMLElement | null;
        if (!container) return;

        // ── Resolve file from container's data-path ────────────────
        const file = this.resolveFile(container, titleRow);
        if (!file) {
            console.log("[InlineRename] click on file row but resolveFile failed");
            return;
        }

        // ── Only intercept clicks on the already-active file ───────
        if (file.path !== this.activeFilePath) {
            console.log("[InlineRename] not active file. clicked:", file.path, "active:", this.activeFilePath);
            return;
        }

        // ── Cooldown: ignore fast double-clicks to open ────────────
        const elapsed = Date.now() - this.activeFileSetAt;
        if (elapsed < 650) {
            console.log("[InlineRename] cooldown active:", elapsed, "ms");
            return;
        }

        console.log("[InlineRename] TRIGGERING RENAME for:", file.path);

        // ── Trigger inline rename ──────────────────────────────────
        evt.preventDefault();
        evt.stopPropagation();
        evt.stopImmediatePropagation();

        this.startInlineRename(titleRow, file);
    };

    // ── Cancel ongoing rename ──────────────────────────────────────

    private cancelRename() {
        this.isRenaming = false;
        this.renamingPath = null;
    }

    // ── Resolve DOM to TFile ───────────────────────────────────────

    private resolveFile(container: HTMLElement, titleRow: HTMLElement): TFile | null {
        // Strategy 1: walk up from titleRow (may have data-path on .tree-item-self)
        // then continue from container
        const seen = new Set<HTMLElement>();
        let el: HTMLElement | null = titleRow;
        while (el) {
            if (seen.has(el)) { el = el.parentElement; continue; }
            seen.add(el);
            const path = el.getAttribute("data-path") ?? el.dataset?.path;
            if (path) {
                const abstract = this.app.vault.getAbstractFileByPath(path);
                if (abstract instanceof TFile) {
                    console.log("[InlineRename] resolved file via data-path:", path);
                    return abstract;
                }
                console.log("[InlineRename] data-path found but file not in vault:", path);
            }
            el = el.parentElement;
        }

        // Strategy 2: match by display name
        const displayName = (titleRow.querySelector(".tree-item-inner") as HTMLElement | null)?.textContent?.trim()
            ?? (titleRow.querySelector(".nav-file-title-content") as HTMLElement | null)?.textContent?.trim()
            ?? titleRow.textContent?.trim();
        if (!displayName) return null;

        const files = this.app.vault.getFiles();
        return (
            files.find((f) => f.name === displayName) ??
            files.find((f) => f.path === displayName) ??
            files.find((f) => f.path.endsWith("/" + displayName)) ??
            null
        );
    }

    // ── Inline rename logic ────────────────────────────────────────

    private startInlineRename(titleRow: HTMLElement, file: TFile) {
        this.isRenaming = true;
        this.renamingPath = file.path;

        const originalName = file.name;
        const ext = file.extension ? "." + file.extension : "";
        const baseName = ext ? originalName.slice(0, -ext.length) : originalName;

        // ── Find the text element to replace ──────────────────────
        const textEl = titleRow.querySelector(".tree-item-inner") as HTMLElement | null
            ?? titleRow.querySelector(".nav-file-title-content") as HTMLElement | null;
        if (!textEl) return;

        textEl.style.display = "none";

        // ── Create input ───────────────────────────────────────────
        const input = document.createElement("input");
        input.type = "text";
        input.value = originalName;
        input.className = "inline-rename-input";

        // Stop clicks on input from navigating
        input.addEventListener("click", (e) => e.stopPropagation());
        input.addEventListener("mousedown", (e) => e.stopPropagation());

        titleRow.appendChild(input);

        // Select basename only
        if (baseName && baseName.length > 0) {
            input.setSelectionRange(0, baseName.length);
        } else {
            input.select();
        }

        requestAnimationFrame(() => input.focus());

        // ── Cleanup ────────────────────────────────────────────────
        const cleanup = () => {
            if (input.parentNode) input.remove();
            textEl.style.display = "";
            this.isRenaming = false;
            this.renamingPath = null;
        };

        let hasCommitted = false;

        const finishRename = async (newNameRaw: string) => {
            if (hasCommitted) return;
            hasCommitted = true;

            const newName = newNameRaw.trim();
            cleanup();

            if (!newName || newName === originalName) return;

            let finalName = newName;
            if (ext && !finalName.endsWith(ext)) {
                finalName = finalName + ext;
            }

            const dirPath = file.path.slice(0, -originalName.length);
            const newPath = dirPath + finalName;

            try {
                await this.app.vault.rename(file, newPath);
                console.log(`[InlineRename] "${originalName}" → "${finalName}"`);
            } catch (err) {
                console.error("[InlineRename] rename failed", err);
            }
        };

        input.addEventListener("blur", () => {
            setTimeout(() => finishRename(input.value), 100);
        });

        input.addEventListener("keydown", (e: KeyboardEvent) => {
            if (e.key === "Enter") {
                e.preventDefault();
                finishRename(input.value);
            } else if (e.key === "Escape") {
                e.preventDefault();
                input.value = originalName;
                hasCommitted = true;
                cleanup();
            }
        });
    }
}
