import c11 from "./grammars/c11";

// Supported grammars for different langauges
export const builtinGrammars = [
  {
    ...c11,
  },
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
    sampleInput:
      '{\n  "name": "Milky Way",\n  "age": 4600000000,\n  "star": "sun",\n  "planets": [ "Mercury", "Venus", "Earth" ],\n  "hot": true,\n  "x": null\n}\n',
  },
  {
    name: "FarshiG3",
    label: "Farshi G3",
    grammar: `
        %token b "b"
        %token x "x"
        %skip /[ \\t\\n\\f\\r]+/

        S -> A S b ;
        S -> x ;
        A -> ;
    `,
  },
  {
    name: "FarshiG4",
    label: "Farshi G4",
    grammar: `
        %token b "b"
        %token x "x"
        %skip /[ \\t\\n\\f\\r]+/

        S -> M | N ;
        M -> A M b ;
        M -> x ;
        N -> A N b ;
        N -> x ;
        A -> ;
    `,
  },
  {
    name: "FarshiG5",
    label: "Farshi G5",
    grammar: `
        %token b "b"
        %token x "x"
        %token t "t"
        %skip /[ \\t\\n\\f\\r]+/

        S -> A S b ;
        S -> x ;
        A -> t ;
        A -> ;
    `,
  },
  {
    name: "FarshiG6",
    label: "Farshi G6",
    grammar: `
        %token b "b"
        %token x "x"
        %skip /[ \\t\\n\\f\\r]+/

        S -> M N ;
        M -> A M b ;
        M -> x ;
        N -> b N A ;
        N -> x ;
        A -> ;
    `,
  },
];
/*
  settings: {
    popoutWholeStack: true,
    blockedPopoutsThrowError: true,
    closePopoutsOnUnload: true,
    hasHeaders: true,
    showPopoutIcon: true,
    showMaximiseIcon: true,
    showMinimiseIcon: true,
  },
 */

// Default config for golden-layout windows
export const defaultGLConfig: any = {
  root: {
    type: "row",
    content: [
      {
        type: "stack",
        content: [
          {
            type: "component",
            content: [],
            width: 50,
            minWidth: 0,
            height: 50,
            minHeight: 0,
            id: "",
            maximised: false,
            isClosable: true,
            reorderEnabled: true,
            title: "Parse Tree",
            componentType: "ptreeArea",
            componentState: {},
          },
        ],
        width: 26.42860403592672,
        minWidth: 0,
        height: 50,
        minHeight: 0,
        id: "",
        isClosable: true,
        maximised: false,
        activeItemIndex: 0,
      },
      {
        type: "column",
        content: [
          {
            type: "stack",
            content: [
              {
                type: "component",
                content: [],
                width: 50,
                minWidth: 0,
                height: 50,
                minHeight: 0,
                id: "",
                maximised: false,
                isClosable: true,
                reorderEnabled: true,
                title: "Grammar",
                componentType: "grammarArea",
                componentState: {},
              },
              {
                type: "component",
                content: [],
                width: 50,
                minWidth: 0,
                height: 50,
                minHeight: 0,
                id: "",
                maximised: false,
                isClosable: true,
                reorderEnabled: true,
                title: "Normalized Grammar",
                componentType: "normalizedGrammarArea",
                componentState: {},
              },
            ],
            width: 49.99999999999999,
            minWidth: 0,
            height: 50,
            minHeight: 0,
            id: "",
            isClosable: true,
            maximised: false,
            activeItemIndex: 0,
          },
          {
            type: "stack",
            content: [
              {
                type: "component",
                content: [],
                width: 50,
                minWidth: 0,
                height: 50,
                minHeight: 0,
                id: "",
                maximised: false,
                isClosable: true,
                reorderEnabled: true,
                title: "Input",
                componentType: "inputArea",
                componentState: {},
              },
            ],
            width: 50,
            minWidth: 0,
            height: 25,
            minHeight: 0,
            id: "",
            isClosable: true,
            maximised: false,
            activeItemIndex: 0,
          },
          {
            type: "stack",
            content: [
              {
                type: "component",
                content: [],
                width: 50,
                minWidth: 0,
                height: 50,
                minHeight: 0,
                id: "",
                maximised: false,
                isClosable: true,
                reorderEnabled: true,
                title: "Console",
                componentType: "consoleArea",
                componentState: {},
              },
            ],
            width: 50,
            minWidth: 0,
            height: 25,
            minHeight: 0,
            id: "",
            isClosable: true,
            maximised: false,
            activeItemIndex: 0,
          },
        ],
        width: 38.606004410776265,
        minWidth: 0,
        height: 50,
        minHeight: 0,
        id: "",
        isClosable: true,
      },
      {
        type: "stack",
        content: [
          {
            type: "component",
            content: [],
            width: 50,
            minWidth: 0,
            height: 50,
            minHeight: 0,
            id: "",
            maximised: false,
            isClosable: true,
            reorderEnabled: true,
            title: "Parse Table",
            componentType: "ptableArea",
            componentState: {},
          },
        ],
        width: 34.96539155329698,
        minWidth: 0,
        height: 50,
        minHeight: 0,
        id: "",
        isClosable: true,
        maximised: false,
        activeItemIndex: 0,
      },
    ],
    width: 50,
    minWidth: 0,
    height: 50,
    minHeight: 0,
    id: "",
    isClosable: true,
  },
  openPopouts: [],
  settings: {
    constrainDragToContainer: true,
    reorderEnabled: true,
    popoutWholeStack: false,
    blockedPopoutsThrowError: true,
    closePopoutsOnUnload: true,
    responsiveMode: "none",
    tabOverlapAllowance: 0,
    reorderOnTabMenuClick: true,
    tabControlOffset: 10,
    popInOnClose: false,
  },
  dimensions: {
    borderWidth: 5,
    borderGrabWidth: 5,
    minItemHeight: 10,
    minItemWidth: 10,
    headerHeight: 20,
    dragProxyWidth: 300,
    dragProxyHeight: 200,
  },
  header: {
    show: "top",
    popout: "open in new window",
    dock: "dock",
    close: "close",
    maximise: "maximise",
    minimise: "minimise",
    tabDropdown: "additional tabs",
  },
  resolved: true,
};
