import {
  ViewPlugin,
  Decoration,
  DecorationSet,
  EditorView,
  ViewUpdate,
  MatchDecorator,
} from "@codemirror/view";
import { DATE_HIGHLIGHT_PATTERN } from "../utils/datePatterns";

const decorator = new MatchDecorator({
  regexp: DATE_HIGHLIGHT_PATTERN,
  decoration: Decoration.mark({ class: "journalite-date-highlight" }),
});

export const dateHighlighterPlugin = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;

    constructor(view: EditorView) {
      this.decorations = decorator.createDeco(view);
    }

    update(update: ViewUpdate) {
      this.decorations = decorator.updateDeco(update, this.decorations);
    }
  },
  {
    decorations: (v) => v.decorations,
  }
);
