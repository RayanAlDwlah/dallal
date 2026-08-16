import coreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

/**
 * eslint-config-next v16 ships native flat configs — composed directly,
 * no FlatCompat (which breaks on ESLint 9).
 */
const eslintConfig = [
  {
    ignores: [".next/**", "node_modules/**", "next-env.d.ts", "supabase/.temp/**"],
  },

  ...coreWebVitals,
  ...nextTypescript,

  {
    rules: {
      /**
       * RTL guard — the interface is Arabic, right-to-left.
       * 1. Physical direction utilities do not mirror; use logical ones
       *    (ms/me, ps/pe, start/end, text-start/end, border-s/e, rounded-s/e).
       * 2. tracking-* letter-spacing breaks Arabic letter joining.
       */
      "no-restricted-syntax": [
        "error",
        {
          selector:
            'JSXAttribute[name.name="className"] Literal[value=/\\b(ml|mr|pl|pr|border-l|border-r|rounded-l|rounded-r)-|\\b(left|right)-[0-9]|\\btext-(left|right)\\b|\\btracking-/]',
          message:
            "RTL: use logical utilities (ms/me, ps/pe, start/end, text-start/end, border-s/e, rounded-s/e). " +
            "Never tracking-* on Arabic — letter-spacing breaks Arabic letter joining.",
        },
      ],
    },
  },
];

export default eslintConfig;
