import js from '@eslint/js';
import pluginImport from 'eslint-plugin-import';
import pluginNode from 'eslint-plugin-n';
import pluginPrettier from 'eslint-plugin-prettier';
import pluginPromise from 'eslint-plugin-promise';
import pluginSecurity from 'eslint-plugin-security';
import pluginSimpleImportSort from 'eslint-plugin-simple-import-sort';
import pluginSonarjs from 'eslint-plugin-sonarjs';
import pluginSortDestructureKeys from 'eslint-plugin-sort-destructure-keys';
import pluginSortKeysFix from 'eslint-plugin-sort-keys-fix';
import pluginUnicorn from 'eslint-plugin-unicorn';
import globals from 'globals';

export default [
    js.configs.recommended,
    pluginImport.flatConfigs.recommended,
    pluginNode.configs['flat/recommended-script'],
    pluginPromise.configs['flat/recommended'],
    pluginSecurity.configs.recommended,
    pluginSonarjs.configs.recommended,
    {
        languageOptions: {
            ecmaVersion: 'latest',
            globals: {
                ...globals.browser,
                ...globals.node,
                chrome: 'readonly',
            },
            sourceType: 'module',
        },
        plugins: {
            prettier: pluginPrettier,
            'simple-import-sort': pluginSimpleImportSort,
            'sort-destructure-keys': pluginSortDestructureKeys,
            'sort-keys-fix': pluginSortKeysFix,
            unicorn: pluginUnicorn,
        },
        rules: {
            'import/extensions': ['error', 'ignorePackages'],

            // NOTE: Currently broken. URL: https://github.com/import-js/eslint-plugin-import/issues/3082
            'n/no-unpublished-import': 'off',

            'prettier/prettier': [
                'error',
                {
                    printWidth: 120,
                    singleQuote: true,
                    tabWidth: 4,
                },
            ],
            'security/detect-object-injection': 'off',
            'simple-import-sort/imports': [
                'error',
                {
                    groups: [
                        ['^node:'],
                        ['^react', '^@?\\w'],
                        ['^(constants)(/.*|$)'],
                        ['^(api|assets|components|contexts|hooks|interfaces|lib|pages|router|types)(/.*|$)'],
                        ['^\\u0000'],
                        ['^\\.\\.(?!/?$)', '^\\.\\./?$'],
                        ['^\\./(?=.*/)(?!/?$)', '^\\.(?!/?$)', '^\\./?$'],
                        ['^.+\\.s?css$'],
                    ],
                },
            ],
            'sonarjs/no-nested-functions': 'off',
            'sort-destructure-keys/sort-destructure-keys': 'warn',
            'sort-keys-fix/sort-keys-fix': 'warn',
            'unicorn/prefer-node-protocol': 'error',
        },
    },
];
