import coreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

/**
 * eslint-config-next v16 ships native flat configs, so they are composed
 * directly. FlatCompat is not used — routing these through the eslintrc
 * compatibility layer fails on ESLint 9 with a circular-structure error.
 */
const eslintConfig = [
  {
    // design/ is Mohammed's design-system reference material. It imports
    // @/lib/* and packages the minimal scaffold does not install, so it is
    // not part of the compiled application yet. Excluded from lint and from
    // tsconfig until S0-09 brings those components into components/.
    // See docs/scaffold-notes.md.
    ignores: ["design/**", ".next/**", "node_modules/**", "next-env.d.ts"],
  },

  ...coreWebVitals,
  ...nextTypescript,

  {
    rules: {
      /**
       * RTL guard — design/STACK.md §4.3.
       *
       * Dalal's interface is Arabic and right-to-left. This rule makes two
       * conventions mechanical instead of review habits:
       *
       *   1. Physical direction utilities (ml/mr/pl/pr/left/right/text-left…)
       *      do not mirror. Use the logical siblings (ms/me, ps/pe,
       *      start/end, text-start/text-end, border-s/border-e,
       *      rounded-s/rounded-e).
       *
       *   2. tracking-* applies letter-spacing, which breaks Arabic letter
       *      joining. See DESIGN_SYSTEM.md §2.1.
       */
      "no-restricted-syntax": [
        "error",
        {
          selector:
            'JSXAttribute[name.name="className"] Literal[value=/\\b(ml|mr|pl|pr|border-l|border-r|rounded-l|rounded-r)-|\\b(left|right)-[0-9]|\\btext-(left|right)\\b|\\btracking-/]',
          message:
            "RTL: use logical utilities (ms/me, ps/pe, start/end, text-start/end, border-s/e, rounded-s/e). " +
            "And never tracking-* on Arabic — letter-spacing breaks Arabic letter joining. See DESIGN_SYSTEM.md §2.1.",
        },
      ],
    },
  },
];

export default eslintConfig;
