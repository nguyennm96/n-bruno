import { targets } from 'httpsnippet';

/** Display name override for specific clients */
const CLIENT_DISPLAY_NAMES = {
  'shell/curl': 'curl',
  'shell/httpie': 'HTTPie',
  'shell/wget': 'wget',
  'javascript/fetch': 'fetch',
  'javascript/xhr': 'XHR',
  'javascript/axios': 'axios',
  'javascript/jquery': 'jQuery',
  'node/native': 'http',
  'node/request': 'request',
  'node/unirest': 'Unirest',
  'node/axios': 'axios',
  'node/fetch': 'fetch',
  'python/python3': 'http.client',
  'python/requests': 'requests',
  'java/asynchttp': 'AsyncHttp',
  'java/nethttp': 'NetHttp',
  'java/okhttp': 'OkHttp',
  'java/unirest': 'Unirest',
  'kotlin/okhttp': 'OkHttp',
  'csharp/httpclient': 'HttpClient',
  'csharp/restsharp': 'RestSharp',
  'php/curl': 'cURL',
  'php/guzzle': 'Guzzle',
  'php/http1': 'HTTP v1',
  'php/http2': 'HTTP v2',
  'ruby/native': 'Net::HTTP',
  'ruby/faraday': 'Faraday',
  'powershell/webrequest': 'WebRequest',
  'powershell/restmethod': 'RestMethod',
  'swift/nsurlsession': 'URLSession',
  'objc/nsurlsession': 'NSURLSession',
  'clojure/clj_http': 'clj-http',
  'ocaml/cohttp': 'cohttp',
  'r/httr': 'httr',
  'rust/reqwest': 'reqwest',
  'go/native': 'net/http',
  'c/libcurl': 'libcurl',
  'crystal/native': 'native',
  'http/http1.1': 'HTTP/1.1'
};

/** CodeMirror mode string for each httpsnippet target key */
const TARGET_CODEMIRROR_MODE = {
  shell: 'shell',
  powershell: 'powershell',
  javascript: 'javascript',
  node: 'javascript',
  python: 'python',
  java: 'text/x-java',
  kotlin: 'text/x-kotlin',
  csharp: 'text/x-csharp',
  php: 'php',
  ruby: 'ruby',
  go: 'go',
  rust: 'rust',
  c: 'text/x-csrc',
  swift: 'swift',
  objc: 'text/x-objectivec',
  clojure: 'clojure',
  crystal: 'crystal',
  ocaml: 'mllike',
  r: 'r',
  http: 'javascript' // no dedicated mode; use plain text fallback
};

/** Category grouping for the language list panel */
const TARGET_CATEGORY = {
  shell: 'Shell',
  powershell: 'Shell',
  javascript: 'JavaScript',
  node: 'JavaScript',
  python: 'Python',
  java: 'JVM',
  kotlin: 'JVM',
  csharp: '.NET',
  php: 'PHP',
  ruby: 'Ruby',
  go: 'Go',
  rust: 'Systems',
  c: 'Systems',
  swift: 'Apple',
  objc: 'Apple',
  clojure: 'Other',
  crystal: 'Other',
  ocaml: 'Other',
  r: 'Other',
  http: 'Other'
};

export const getLanguages = () => {
  const allLanguages = [];

  for (const target of Object.values(targets)) {
    const { key, title } = target.info;
    const clients = Object.keys(target.clientsById);
    const codemirrorMode = TARGET_CODEMIRROR_MODE[key] || null;
    const category = TARGET_CATEGORY[key] || 'Other';

    const languages = (clients.length === 1)
      ? [{
          name: title,
          target: key,
          client: clients[0],
          displayName: title,
          clientDisplayName: CLIENT_DISPLAY_NAMES[`${key}/${clients[0]}`] || clients[0],
          codemirrorMode,
          category
        }]
      : clients.map((client) => ({
          name: `${title}-${client}`,
          target: key,
          client,
          displayName: title,
          clientDisplayName: CLIENT_DISPLAY_NAMES[`${key}/${client}`] || client,
          codemirrorMode,
          category
        }));

    allLanguages.push(...languages);
  }

  // Pin Shell-curl to the top
  const shellCurlIndex = allLanguages.findIndex((lang) => lang.name === 'Shell-curl');
  if (shellCurlIndex !== -1) {
    const [shellCurl] = allLanguages.splice(shellCurlIndex, 1);
    allLanguages.unshift(shellCurl);
  }

  return allLanguages;
};
