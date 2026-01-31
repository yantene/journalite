import { Plugin, debounce, TFile } from "obsidian";
import { JournaliteView, VIEW_TYPE_JOURNALITE } from "./src/views/JournaliteView";
import { JournaliteSettingTab, DEFAULT_SETTINGS, type JournaliteSettings } from "./src/settings";

export default class JournalitePlugin extends Plugin {
  private journaliteView: JournaliteView | null = null;
  settings: JournaliteSettings = DEFAULT_SETTINGS;

  async onload(): Promise<void> {
    await this.loadSettings();

    // Add settings tab
    this.addSettingTab(new JournaliteSettingTab(this.app, this));

    // Register view
    this.registerView(VIEW_TYPE_JOURNALITE, (leaf) => {
      this.journaliteView = new JournaliteView(leaf, this);
      return this.journaliteView;
    });

    // Register command
    this.addCommand({
      id: "open-journalite-panel",
      name: "Open Journalite panel",
      callback: () => {
        this.activateView();
      },
    });

    // Ribbon icon
    this.addRibbonIcon("calendar-clock", "Journalite", () => {
      this.activateView();
    });

    // Refresh on file changes (debounced)
    const debouncedRefresh = debounce(() => {
      this.refreshView();
    }, 500);

    // Watch file create/delete/modify events
    this.registerEvent(
      this.app.vault.on("create", (file) => {
        if (file instanceof TFile && file.extension === "md") {
          debouncedRefresh();
        }
      })
    );

    this.registerEvent(
      this.app.vault.on("delete", (file) => {
        if (file instanceof TFile && file.extension === "md") {
          debouncedRefresh();
        }
      })
    );

    this.registerEvent(
      this.app.vault.on("rename", (file) => {
        if (file instanceof TFile && file.extension === "md") {
          debouncedRefresh();
        }
      })
    );

    this.registerEvent(
      this.app.vault.on("modify", (file) => {
        if (file instanceof TFile && file.extension === "md") {
          debouncedRefresh();
        }
      })
    );

    // Also refresh on metadata cache updates
    this.registerEvent(
      this.app.metadataCache.on("changed", (file) => {
        if (file.extension === "md") {
          debouncedRefresh();
        }
      })
    );

    // Open view on startup
    this.app.workspace.onLayoutReady(() => {
      this.activateView();
    });
  }

  async onunload(): Promise<void> {
    this.app.workspace.detachLeavesOfType(VIEW_TYPE_JOURNALITE);
  }

  private async activateView(): Promise<void> {
    const { workspace } = this.app;

    let leaf = workspace.getLeavesOfType(VIEW_TYPE_JOURNALITE)[0];

    if (!leaf) {
      const rightLeaf = workspace.getRightLeaf(false);
      if (rightLeaf) {
        leaf = rightLeaf;
        await leaf.setViewState({
          type: VIEW_TYPE_JOURNALITE,
          active: true,
        });
      }
    }

    if (leaf) {
      workspace.revealLeaf(leaf);
      if (leaf.view instanceof JournaliteView) {
        this.journaliteView = leaf.view;
      }
    }
  }

  private refreshView(): void {
    if (!this.journaliteView) {
      const leaves = this.app.workspace.getLeavesOfType(VIEW_TYPE_JOURNALITE);
      if (leaves.length > 0 && leaves[0].view instanceof JournaliteView) {
        this.journaliteView = leaves[0].view;
      }
    }

    if (this.journaliteView) {
      this.journaliteView.refresh();
    }
  }

  async loadSettings(): Promise<void> {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
  }
}
