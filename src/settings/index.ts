import { App, PluginSettingTab, Setting } from "obsidian";
import type JournalitePlugin from "../../main";

export type TaskTemplateMode = "obsidian" | "custom";

export interface JournaliteSettings {
  tasksFolder: string;
  taskTemplateMode: TaskTemplateMode;
  taskTemplatePath: string;
}

export const DEFAULT_SETTINGS: JournaliteSettings = {
  tasksFolder: "tasks",
  taskTemplateMode: "obsidian",
  taskTemplatePath: "",
};

export class JournaliteSettingTab extends PluginSettingTab {
  plugin: JournalitePlugin;

  constructor(app: App, plugin: JournalitePlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    containerEl.createEl("h2", { text: "Journalite Settings" });

    new Setting(containerEl)
      .setName("Tasks folder")
      .setDesc("Folder where task files are created")
      .addText((text) =>
        text
          .setPlaceholder("tasks")
          .setValue(this.plugin.settings.tasksFolder)
          .onChange(async (value) => {
            this.plugin.settings.tasksFolder = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Task template")
      .setDesc("How to locate the template for new tasks")
      .addDropdown((dropdown) =>
        dropdown
          .addOption("obsidian", "Use task.md from Obsidian templates folder")
          .addOption("custom", "Specify custom path")
          .setValue(this.plugin.settings.taskTemplateMode)
          .onChange(async (value: TaskTemplateMode) => {
            this.plugin.settings.taskTemplateMode = value;
            await this.plugin.saveSettings();
            this.display();
          })
      );

    if (this.plugin.settings.taskTemplateMode === "custom") {
      new Setting(containerEl)
        .setName("Template path")
        .setDesc("Path to the task template file")
        .addText((text) =>
          text
            .setPlaceholder("path/to/task-template.md")
            .setValue(this.plugin.settings.taskTemplatePath)
            .onChange(async (value) => {
              this.plugin.settings.taskTemplatePath = value;
              await this.plugin.saveSettings();
            })
        );
    }
  }
}
