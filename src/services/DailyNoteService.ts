import { type App, TFile } from "obsidian";
import { formatDate } from "../utils/dateUtils";

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
    const dateStr = formatDate(date);
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
    const dateStr = formatDate(date);

    // Replace template variables
    content = content.replace(/\{\{date:YYYY-MM-DD\}\}/g, dateStr);
    content = content.replace(/\{\{date\}\}/g, dateStr);

    return content;
  }

  /** Get list of existing daily note dates (identified by YYYY-MM-DD.md filename) */
  getExistingDates(): Set<string> {
    const dates = new Set<string>();
    const files = this.app.vault.getMarkdownFiles();

    for (const file of files) {
      // Extract date from filename (YYYY-MM-DD.md format)
      const match = file.name.match(/^(\d{4}-\d{2}-\d{2})\.md$/);
      if (!match) continue;

      dates.add(match[1]);
    }

    return dates;
  }

}
