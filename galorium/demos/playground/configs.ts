
// Supported grammars for different langauges
export const builtinGrammars = [
  {
    name: "JSON",
    label: "JSON",
    selected: true,
    grammar: `
        %token NUMBER /-?\\d+(\\.\\d+)?([eE][+-]?\\d+)?/
        %token STRING /".*?(?<!\\\\)"/
        %skip /[ \\t\\n\\f\\r]+/

        Value -> Dict | List | STRING | NUMBER | Boolean | "null" ;
        List -> "[" [ Value ( "," Value ) * ] "]" ;
        Dict -> "{" [ Pair ("," Pair)* ] "}" ;
        Pair -> STRING ":" Value ;
        Boolean -> "true" | "false" ;
    `,
  },
];

// Default config for golden-layout windows
export const defaultGLConfig: any = {
  content: [
    {
      type: "row",
      content: [
        {
          type: "column",
          content: [
            {
              type: "component",
              componentName: "grammarArea",
              title: "Grammar",
            },
            {
              type: "component",
              componentName: "inputArea",
              title: "Input",
            },
          ],
        },
        {
          type: "column",
          content: [
            {
              type: "column",
              content: [
                {
                  type: "row",
                  content: [
                    {
                      type: "component",
                      componentName: "ptreeArea",
                      title: "Parse Tree",
                    },
                    {
                      type: "component",
                      componentName: "ptableArea",
                      title: "Parse Table",
                    },
                  ],
                },
                {
                  type: "stack",
                  content: [
                    {
                      title: "Console",
                      type: "component",
                      componentName: "consoleArea",
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    },
  ],
};
