import { rgba, lighten, darken } from 'polished';

// Ahamove brand colors
// Primary: #FF6B00 (vibrant orange — logo & CTA)
// Background: warm dark charcoal

export const palette = {
  primary: {
    SOLID: 'hsl(25, 100%, 50%)', // #FF6B00
    TEXT: 'hsl(25, 100%, 60%)', // lighter for text on dark bg
    STRONG: 'hsl(25, 100%, 65%)',
    SUBTLE: 'hsl(25, 100%, 45%)'
  },
  hues: {
    RED: 'hsl(4,  80%, 58%)',
    ROSE: 'hsl(355, 80%, 68%)',
    BROWN: 'hsl(32,  65%, 72%)',
    ORANGE: 'hsl(25, 100%, 62%)',
    YELLOW: 'hsl(42,  95%, 65%)',
    GREEN: 'hsl(138, 60%, 60%)',
    GREEN_DARK: 'hsl(155, 88%, 40%)',
    TEAL: 'hsl(172, 65%, 55%)',
    CYAN: 'hsl(192, 80%, 65%)',
    BLUE: 'hsl(212, 90%, 68%)',
    INDIGO: 'hsl(230, 80%, 72%)',
    VIOLET: 'hsl(262, 70%, 74%)',
    PURPLE: 'hsl(282, 65%, 70%)',
    PINK: 'hsl(310, 60%, 70%)'
  },
  system: {
    CONTROL_ACCENT: '#FF6B00'
  },
  background: {
    BASE: 'hsl(22, 10%, 9%)', // warm near-black
    MANTLE: 'hsl(22, 9%, 12%)',
    CRUST: 'hsl(22, 10%, 7%)',
    SURFACE0: 'hsl(22, 8%, 15%)',
    SURFACE1: 'hsl(22, 7%, 20%)',
    SURFACE2: 'hsl(22, 6%, 32%)'
  },
  text: {
    BASE: 'hsl(30, 15%, 85%)',
    SUBTEXT2: 'hsl(30, 10%, 72%)',
    SUBTEXT1: 'hsl(30, 8%, 58%)',
    SUBTEXT0: 'hsl(30, 6%, 44%)'
  },
  overlay: {
    OVERLAY2: '#6a6460',
    OVERLAY1: '#575350',
    OVERLAY0: '#464341'
  },
  border: {
    BORDER2: '#3d3a37',
    BORDER1: '#312e2c',
    BORDER0: '#272523'
  },
  utility: {
    WHITE: '#ffffff',
    BLACK: '#000000'
  }
};

palette.intent = {
  INFO: palette.hues.BLUE,
  SUCCESS: palette.hues.GREEN,
  WARNING: palette.hues.YELLOW,
  DANGER: palette.hues.RED
};

palette.syntax = {
  KEYWORD: palette.hues.ORANGE,
  TAG: palette.hues.ROSE,
  VARIABLE: palette.hues.PINK,
  PROPERTY: palette.hues.CYAN,
  DEFINITION: palette.hues.BLUE,
  STRING: palette.hues.GREEN,
  NUMBER: palette.hues.YELLOW,
  ATOM: palette.hues.ORANGE,
  OPERATOR: palette.text.SUBTEXT1,
  TAG_BRACKET: palette.text.SUBTEXT1,
  COMMENT: palette.text.SUBTEXT0
};

const colors = {
  GRAY_2: '#3a3633',
  GRAY_3: '#423e3b',
  GRAY_4: '#6a6460',
  GRAY_5: '#a8a09a'
};

const ahamoveTheme = {
  mode: 'dark',
  brand: palette.primary.SOLID,
  text: palette.text.BASE,
  textLink: palette.hues.CYAN,
  draftColor: '#FF8C33',
  bg: palette.background.BASE,

  primary: {
    solid: palette.primary.SOLID,
    text: palette.primary.TEXT,
    strong: palette.primary.STRONG,
    subtle: palette.primary.SUBTLE
  },

  accents: {
    primary: palette.primary.SOLID
  },

  background: {
    base: palette.background.BASE,
    mantle: palette.background.MANTLE,
    crust: palette.background.CRUST,
    surface0: palette.background.SURFACE0,
    surface1: palette.background.SURFACE1,
    surface2: palette.background.SURFACE2
  },

  status: {
    info: {
      background: rgba(palette.intent.INFO, 0.15),
      text: palette.intent.INFO,
      border: palette.intent.INFO
    },
    success: {
      background: rgba(palette.intent.SUCCESS, 0.15),
      text: palette.intent.SUCCESS,
      border: palette.intent.SUCCESS
    },
    warning: {
      background: rgba(palette.intent.WARNING, 0.15),
      text: palette.intent.WARNING,
      border: palette.intent.WARNING
    },
    danger: {
      background: rgba(palette.intent.DANGER, 0.15),
      text: palette.intent.DANGER,
      border: palette.intent.DANGER
    }
  },

  overlay: {
    overlay2: palette.overlay.OVERLAY2,
    overlay1: palette.overlay.OVERLAY1,
    overlay0: palette.overlay.OVERLAY0
  },

  font: {
    size: {
      xs: '0.6875rem',
      sm: '0.75rem',
      base: '0.8125rem',
      md: '0.875rem',
      lg: '1rem',
      xl: '1.125rem'
    }
  },

  shadow: {
    sm: '0 1px 3px rgba(0, 0, 0, 0.6), 0 0 0 1px rgba(0, 0, 0, 0.4)',
    md: '0 2px 8px rgba(0, 0, 0, 0.7), 0 0 0 1px rgba(0, 0, 0, 0.5)',
    lg: '0 2px 12px rgba(0, 0, 0, 0.8), 0 0 0 1px rgba(0, 0, 0, 0.5)'
  },

  transition: {
    fast: '0.1s ease',
    base: '0.15s ease',
    slow: '0.25s cubic-bezier(0.4, 0, 0.2, 1)',
    spring: '0.2s cubic-bezier(0.34, 1.56, 0.64, 1)'
  },

  border: {
    radius: {
      sm: '4px',
      base: '6px',
      md: '8px',
      lg: '10px',
      xl: '12px'
    },
    border2: palette.border.BORDER2,
    border1: palette.border.BORDER1,
    border0: palette.border.BORDER0
  },

  colors: {
    text: {
      white: palette.text.BASE,
      green: palette.intent.SUCCESS,
      danger: palette.intent.DANGER,
      warning: palette.intent.WARNING,
      muted: palette.text.SUBTEXT1,
      purple: palette.hues.PURPLE,
      yellow: palette.hues.YELLOW,
      subtext2: palette.text.SUBTEXT2,
      subtext1: palette.text.SUBTEXT1,
      subtext0: palette.text.SUBTEXT0
    },
    bg: {
      danger: palette.hues.RED
    },
    accent: palette.system.CONTROL_ACCENT
  },

  input: {
    bg: 'transparent',
    border: palette.border.BORDER2,
    focusBorder: rgba(palette.primary.SOLID, 0.7),
    placeholder: {
      color: palette.text.SUBTEXT1,
      opacity: 0.6
    }
  },

  sidebar: {
    color: palette.text.BASE,
    muted: palette.text.SUBTEXT1,
    bg: palette.background.BASE,
    dragbar: {
      border: palette.border.BORDER1,
      activeBorder: palette.border.BORDER2
    },
    collection: {
      item: {
        bg: palette.background.SURFACE0,
        hoverBg: palette.background.MANTLE,
        focusBorder: palette.border.BORDER2,
        indentBorder: palette.background.SURFACE0,
        active: {
          indentBorder: rgba(palette.primary.SOLID, 0.5)
        },
        example: {
          iconColor: palette.text.BASE
        }
      }
    },
    dropdownIcon: {
      color: palette.text.BASE
    }
  },

  dropdown: {
    color: palette.text.BASE,
    iconColor: palette.text.SUBTEXT2,
    bg: palette.background.MANTLE,
    hoverBg: palette.background.SURFACE0,
    shadow: 'none',
    border: palette.border.BORDER1,
    separator: palette.border.BORDER1,
    selectedColor: palette.primary.TEXT,
    mutedText: palette.text.SUBTEXT1
  },

  workspace: {
    accent: palette.primary.SOLID,
    border: palette.border.BORDER2,
    button: {
      bg: colors.GRAY_2
    }
  },

  request: {
    methods: {
      get: palette.hues.GREEN,
      post: palette.hues.INDIGO,
      put: palette.hues.ORANGE,
      delete: lighten(0.08, palette.hues.RED),
      patch: palette.hues.YELLOW,
      options: palette.hues.TEAL,
      head: palette.hues.CYAN
    },
    grpc: palette.hues.TEAL,
    ws: palette.hues.ORANGE,
    gql: palette.hues.PINK
  },

  requestTabPanel: {
    url: {
      bg: palette.background.BASE,
      icon: palette.text.SUBTEXT2,
      iconDanger: '#fa5343',
      border: `solid 1px ${palette.border.BORDER1}`
    },
    dragbar: {
      border: palette.border.BORDER1,
      activeBorder: palette.border.BORDER2
    },
    responseStatus: palette.text.SUBTEXT2,
    responseOk: palette.hues.GREEN,
    responseError: palette.hues.RED,
    responsePending: palette.hues.BLUE,
    responseOverlayBg: rgba(palette.background.BASE, 0.8),
    card: {
      bg: palette.background.SURFACE0,
      border: 'transparent',
      hr: palette.border.BORDER2
    },
    graphqlDocsExplorer: {
      bg: palette.background.CRUST,
      color: palette.text.BASE
    }
  },

  notifications: {
    bg: colors.GRAY_3,
    list: {
      bg: colors.GRAY_2,
      borderRight: palette.border.BORDER2,
      borderBottom: palette.border.BORDER2,
      hoverBg: colors.GRAY_3,
      active: {
        border: palette.primary.SOLID,
        bg: colors.GRAY_3,
        hoverBg: colors.GRAY_3
      }
    }
  },

  modal: {
    title: {
      color: palette.text.BASE,
      bg: palette.background.BASE
    },
    body: {
      color: palette.text.BASE,
      bg: palette.background.MANTLE
    },
    input: {
      bg: 'transparent',
      border: palette.border.BORDER2,
      focusBorder: rgba(palette.primary.SOLID, 0.7)
    },
    backdrop: {
      opacity: 0.3
    }
  },

  button: {
    secondary: {
      color: palette.text.BASE,
      bg: rgba(palette.primary.SOLID, 0.15),
      border: rgba(palette.primary.SOLID, 0.3),
      hoverBorder: rgba(palette.primary.SOLID, 0.6)
    },
    close: {
      color: palette.text.SUBTEXT1,
      bg: 'transparent',
      border: 'transparent',
      hoverBorder: ''
    },
    disabled: {
      color: '#7a7370',
      bg: '#3a3633',
      border: '#3a3633'
    },
    danger: {
      color: '#fff',
      bg: '#dc3545',
      border: '#dc3545'
    }
  },

  button2: {
    color: {
      primary: {
        bg: palette.primary.SOLID,
        text: palette.utility.BLACK,
        border: palette.primary.SOLID
      },
      light: {
        bg: rgba(palette.primary.SOLID, 0.12),
        text: palette.primary.TEXT,
        border: rgba(palette.primary.SOLID, 0.08)
      },
      secondary: {
        bg: palette.background.MANTLE,
        text: palette.text.BASE,
        border: palette.border.BORDER1
      },
      success: {
        bg: palette.hues.GREEN,
        text: palette.utility.WHITE,
        border: palette.hues.GREEN
      },
      warning: {
        bg: palette.hues.YELLOW,
        text: '#1a1210',
        border: palette.hues.YELLOW
      },
      danger: {
        bg: palette.hues.RED,
        text: palette.utility.WHITE,
        border: palette.hues.RED
      }
    }
  },

  tabs: {
    marginRight: '1.2rem',
    active: {
      fontWeight: 400,
      color: palette.text.BASE,
      border: palette.primary.SOLID
    },
    secondary: {
      active: {
        bg: palette.background.SURFACE0,
        color: palette.text.BASE
      },
      inactive: {
        bg: palette.background.SURFACE0,
        color: palette.text.SUBTEXT1
      }
    }
  },

  requestTabs: {
    color: palette.text.BASE,
    bg: palette.background.SURFACE0,
    bottomBorder: palette.border.BORDER2,
    icon: {
      color: colors.GRAY_5,
      hoverColor: palette.text.BASE,
      hoverBg: palette.background.CRUST
    },
    example: {
      iconColor: colors.GRAY_5
    }
  },

  codemirror: {
    bg: palette.background.BASE,
    border: palette.background.BASE,
    placeholder: {
      color: '#8a8480',
      opacity: 0.5
    },
    gutter: {
      bg: palette.background.BASE
    },
    variable: {
      valid: palette.hues.GREEN_DARK,
      invalid: palette.hues.RED,
      prompt: palette.hues.CYAN
    },
    tokens: {
      definition: palette.syntax.DEFINITION,
      property: palette.syntax.PROPERTY,
      string: palette.syntax.STRING,
      number: palette.syntax.NUMBER,
      atom: palette.syntax.ATOM,
      variable: palette.syntax.VARIABLE,
      keyword: palette.syntax.KEYWORD,
      comment: palette.syntax.COMMENT,
      operator: palette.syntax.OPERATOR,
      tag: palette.syntax.TAG,
      tagBracket: palette.syntax.TAG_BRACKET
    },
    searchLineHighlightCurrent: 'rgba(255, 107, 0, 0.12)',
    searchMatch: '#FFD700',
    searchMatchActive: '#FFFF00'
  },

  table: {
    border: palette.border.BORDER1,
    thead: {
      color: palette.text.SUBTEXT2
    },
    striped: palette.background.CRUST,
    input: {
      color: palette.text.BASE
    }
  },

  plainGrid: {
    hoverBg: colors.GRAY_3
  },

  scrollbar: {
    color: 'hsl(22, 8%, 22%)'
  },

  dragAndDrop: {
    border: rgba(palette.primary.SOLID, 0.6),
    borderStyle: '2px solid',
    hoverBg: rgba(palette.primary.SOLID, 0.06),
    transition: 'all 0.1s ease'
  },

  infoTip: {
    bg: palette.background.MANTLE,
    border: palette.border.BORDER1,
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.6)'
  },

  statusBar: {
    border: palette.border.BORDER1,
    color: palette.text.SUBTEXT1
  },

  console: {
    bg: palette.background.CRUST,
    headerBg: palette.background.BASE,
    contentBg: palette.background.CRUST,
    border: palette.border.BORDER2,
    titleColor: palette.text.BASE,
    countColor: palette.text.SUBTEXT0,
    buttonColor: palette.text.BASE,
    buttonHoverBg: rgba(palette.primary.SOLID, 0.1),
    buttonHoverColor: palette.primary.TEXT,
    messageColor: palette.text.BASE,
    timestampColor: palette.text.SUBTEXT0,
    emptyColor: palette.text.SUBTEXT0,
    logHoverBg: rgba(palette.primary.SOLID, 0.05),
    resizeHandleHover: palette.primary.SOLID,
    resizeHandleActive: palette.primary.SOLID,
    dropdownBg: palette.background.MANTLE,
    dropdownHeaderBg: palette.background.SURFACE0,
    optionHoverBg: rgba(palette.primary.SOLID, 0.08),
    optionLabelColor: palette.text.BASE,
    optionCountColor: palette.text.SUBTEXT0,
    checkboxColor: palette.primary.SOLID,
    scrollbarTrack: palette.background.MANTLE,
    scrollbarThumb: palette.border.BORDER2,
    scrollbarThumbHover: palette.border.BORDER1
  },

  grpc: {
    tabNav: {
      container: {
        bg: palette.background.SURFACE0
      },
      button: {
        active: {
          bg: rgba(palette.primary.SOLID, 0.2),
          color: palette.primary.TEXT
        },
        inactive: {
          bg: 'transparent',
          color: palette.text.SUBTEXT1
        }
      }
    },
    importPaths: {
      header: {
        text: palette.text.SUBTEXT1,
        button: {
          color: palette.text.SUBTEXT1,
          hoverColor: palette.text.BASE
        }
      },
      error: {
        bg: 'transparent',
        text: palette.hues.RED,
        link: {
          color: palette.hues.RED,
          hoverColor: lighten(0.1, palette.hues.RED)
        }
      },
      item: {
        bg: 'transparent',
        hoverBg: rgba(palette.primary.SOLID, 0.05),
        text: palette.text.BASE,
        icon: palette.text.SUBTEXT1,
        checkbox: {
          color: palette.text.BASE
        },
        invalid: {
          opacity: 0.6,
          text: palette.hues.RED
        }
      },
      empty: {
        text: palette.text.SUBTEXT1
      },
      button: {
        bg: rgba(palette.primary.SOLID, 0.15),
        color: palette.text.BASE,
        border: rgba(palette.primary.SOLID, 0.3),
        hoverBorder: rgba(palette.primary.SOLID, 0.6)
      }
    },
    protoFiles: {
      header: {
        text: palette.text.SUBTEXT1,
        button: {
          color: palette.text.SUBTEXT1,
          hoverColor: palette.text.BASE
        }
      },
      error: {
        bg: 'transparent',
        text: palette.hues.RED,
        link: {
          color: palette.hues.RED,
          hoverColor: lighten(0.1, palette.hues.RED)
        }
      },
      item: {
        bg: 'transparent',
        hoverBg: rgba(palette.primary.SOLID, 0.05),
        selected: {
          bg: rgba(palette.primary.SOLID, 0.15),
          border: palette.primary.SOLID
        },
        text: palette.text.BASE,
        secondaryText: palette.text.SUBTEXT1,
        icon: palette.text.SUBTEXT1,
        invalid: {
          opacity: 0.6,
          text: palette.hues.RED
        }
      },
      empty: {
        text: palette.text.SUBTEXT1
      },
      button: {
        bg: rgba(palette.primary.SOLID, 0.15),
        color: palette.text.BASE,
        border: rgba(palette.primary.SOLID, 0.3),
        hoverBorder: rgba(palette.primary.SOLID, 0.6)
      }
    }
  },

  deprecationWarning: {
    bg: rgba(palette.hues.RED, 0.1),
    border: rgba(palette.hues.RED, 0.1),
    icon: palette.hues.RED,
    text: palette.text.SUBTEXT2
  },

  examples: {
    buttonBg: rgba(palette.primary.SOLID, 0.1),
    buttonColor: palette.primary.TEXT,
    buttonText: '#fff',
    buttonIconColor: '#fff',
    border: palette.border.BORDER2,
    urlBar: {
      border: palette.border.BORDER2,
      bg: palette.background.SURFACE0
    },
    table: {
      thead: {
        bg: palette.background.SURFACE0,
        color: palette.text.SUBTEXT1
      }
    },
    checkbox: {
      color: '#000'
    }
  },

  app: {
    collection: {
      toolbar: {
        environmentSelector: {
          bg: palette.background.BASE,
          border: palette.border.BORDER2,
          icon: palette.primary.TEXT,
          text: palette.text.BASE,
          caret: palette.text.SUBTEXT1,
          separator: palette.border.BORDER2,
          hoverBg: palette.background.BASE,
          hoverBorder: palette.border.BORDER2,
          noEnvironment: {
            text: palette.text.SUBTEXT1,
            bg: palette.background.BASE,
            border: palette.border.BORDER2,
            hoverBg: palette.background.BASE,
            hoverBorder: palette.border.BORDER1
          }
        },
        sandboxMode: {
          safeMode: {
            bg: rgba(palette.hues.TEAL, 0.12),
            color: palette.hues.TEAL
          },
          developerMode: {
            bg: rgba(palette.primary.SOLID, 0.11),
            color: palette.primary.TEXT
          }
        }
      }
    }
  }
};

export default ahamoveTheme;
