import { type App, TFile, TFolder } from "obsidian";
import { formatDate, formatDateCustom, parseDateString } from "../utils/dateUtils";

interface DailyNotesSettings {
  folder: string;
  template: string;
  format: string;
}

const DEFAULT_SETTINGS: DailyNotesSettings = {
  folder: "",
  template: "",
  format: "YYYY-MM-DD",
};

export class DailyNoteService {
  constructor(private app: App) {}

  /** Get Daily Notes plugin settings */
  private getSettings(): DailyNotesSettings {
    const internalPlugins = (this.app as any).internalPlugins;
    const dailyNotesPlugin = internalPlugins?.getPluginById?.("daily-notes");
    const options = dailyNotesPlugin?.instance?.options;

    return {
      folder: options?.folder || DEFAULT_SETTINGS.folder,
      template: options?.template || DEFAULT_SETTINGS.template,
      format: options?.format || DEFAULT_SETTINGS.format,
    };
  }

  /** Generate daily note path */
  getDailyNotePath(date: Date): string {
    const settings = this.getSettings();
    const dateStr = formatDateCustom(date, settings.format);
    const folder = settings.folder ? `${settings.folder}/` : "";
    return `${folder}${dateStr}.md`;
  }

  /** Check if daily note exists */
  exists(date: Date): boolean {
    const path = this.getDailyNotePath(date);
    return this.app.vault.getAbstractFileByPath(path) !== null;
  }

  /** Get daily note */
  get(date: Date): TFile | null {
    const path = this.getDailyNotePath(date);
    const file = this.app.vault.getAbstractFileByPath(path);
    if (file instanceof TFile) {
      return file;
    }
    return null;
  }

  /** Open daily note for the specified date (create if not exists) */
  async openOrCreate(date: Date): Promise<void> {
    const path = this.getDailyNotePath(date);
    let file = this.app.vault.getAbstractFileByPath(path) as TFile | null;

    if (!file) {
      await this.ensureFolderExists(path);
      const content = await this.generateContent(date);
      file = await this.app.vault.create(path, content);
    }

    const leaf = this.app.workspace.getLeaf(false);
    await leaf.openFile(file);
  }

  /** Generate content from template */
  private async generateContent(date: Date): Promise<string> {
    const settings = this.getSettings();
    const templatePath = settings.template ? `${settings.template}.md` : "";
    const templateFile = templatePath
      ? this.app.vault.getAbstractFileByPath(templatePath) as TFile | null
      : null;

    if (!templateFile) {
      // Default content when no template exists
      const dateStr = formatDate(date);
      return `---\ntags:\ndate: "${dateStr}"\n---\n## Journal\n## Thoughts\n- `;
    }

    let content = await this.app.vault.read(templateFile);

    // Replace {{date:FORMAT}} with the date in the specified format
    content = content.replace(/\{\{date:([^}]+)\}\}/g, (_, fmt) => {
      return formatDateCustom(date, fmt);
    });
    // Replace {{date}} with the date in the configured daily notes format
    content = content.replace(/\{\{date\}\}/g, formatDateCustom(date, settings.format));

    return content;
  }

  /** Check if a file is a daily note */
  isDailyNote(file: TFile): boolean {
    return this.parseDailyNoteDate(file) !== null;
  }

  /** Parse date from a daily note file. Returns YYYY-MM-DD or null. */
  parseDailyNoteDate(file: TFile): string | null {
    const settings = this.getSettings();
    const folder = settings.folder;

    // Get path without .md extension
    const pathWithoutExt = file.path.replace(/\.md$/, "");

    // Strip folder prefix
    let relativePath: string;
    if (folder) {
      if (!pathWithoutExt.startsWith(folder + "/")) return null;
      relativePath = pathWithoutExt.substring(folder.length + 1);
    } else {
      relativePath = pathWithoutExt;
    }

    return parseDateString(relativePath, settings.format);
  }

  /** Get list of existing daily note dates */
  getExistingDates(): Set<string> {
    const dates = new Set<string>();
    const files = this.app.vault.getMarkdownFiles();

    for (const file of files) {
      const date = this.parseDailyNoteDate(file);
      if (date) {
        dates.add(date);
      }
    }

    return dates;
  }

  /** Ensure parent folders exist for a file path */
  private async ensureFolderExists(filePath: string): Promise<void> {
    const lastSlash = filePath.lastIndexOf("/");
    if (lastSlash < 0) return;

    const folderPath = filePath.substring(0, lastSlash);
    if (this.app.vault.getAbstractFileByPath(folderPath) instanceof TFolder) return;

    const parts = folderPath.split("/");
    let current = "";
    for (const part of parts) {
      current = current ? `${current}/${part}` : part;
      if (!this.app.vault.getAbstractFileByPath(current)) {
        await this.app.vault.createFolder(current);
      }
    }
  }
}
