import { useState, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { getLanguages } from 'utils/codegenerator/targets';
import { updateGenerateCode } from 'providers/ReduxStore/slices/app';
import { IconSearch } from '@tabler/icons';
import StyledWrapper from './StyledWrapper';

const CATEGORY_ORDER = ['Shell', 'JavaScript', 'Python', 'JVM', '.NET', 'PHP', 'Ruby', 'Go', 'Systems', 'Apple', 'Other'];

const LanguageList = () => {
  const dispatch = useDispatch();
  const languages = useMemo(() => getLanguages(), []);
  const generateCodePrefs = useSelector((state) => state.app.generateCode);
  const [search, setSearch] = useState('');

  const mainLanguages = useMemo(() => {
    const map = new Map();
    for (const lang of languages) {
      const key = `${lang.displayName}:${lang.target}`;
      if (!map.has(key)) {
        map.set(key, {
          displayName: lang.displayName,
          target: lang.target,
          category: lang.category,
          codemirrorMode: lang.codemirrorMode,
          clients: []
        });
      }
      map.get(key).clients.push({
        client: lang.client,
        clientDisplayName: lang.clientDisplayName,
        name: lang.name
      });
    }
    return Array.from(map.values());
  }, [languages]);

  const filteredLanguages = useMemo(() => {
    if (!search.trim()) return mainLanguages;
    const q = search.toLowerCase();
    return mainLanguages.filter(
      (l) =>
        l.displayName.toLowerCase().includes(q)
        || l.clients.some((c) => c.clientDisplayName.toLowerCase().includes(q))
        || l.category.toLowerCase().includes(q)
    );
  }, [mainLanguages, search]);

  const grouped = useMemo(() => {
    const map = {};
    for (const lang of filteredLanguages) {
      if (!map[lang.category]) map[lang.category] = [];
      map[lang.category].push(lang);
    }
    for (const category of Object.keys(map)) {
      map[category].sort((a, b) => a.displayName.localeCompare(b.displayName));
    }
    return map;
  }, [filteredLanguages]);

  const orderedCategories = CATEGORY_ORDER.filter((c) => grouped[c]);

  const handleSelect = (lang) => {
    const isMultiClient = lang.clients.length > 1;
    const remembered = generateCodePrefs.lastLibraryByLanguage?.[lang.displayName];
    const rememberedExists = remembered && lang.clients.some((c) => c.client === remembered);
    const defaultClient = lang.clients[0]?.client || 'default';
    dispatch(updateGenerateCode({
      mainLanguage: lang.displayName,
      library: isMultiClient ? (rememberedExists ? remembered : defaultClient) : 'default'
    }));
  };

  const isSelected = (lang) => lang.displayName === generateCodePrefs.mainLanguage;

  return (
    <StyledWrapper>
      <div className="search-row">
        <IconSearch size={14} className="search-icon" />
        <input
          className="search-input"
          type="text"
          placeholder="Search language..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          autoComplete="off"
          spellCheck={false}
        />
      </div>

      <div className="language-scroll">
        {orderedCategories.map((category) => (
          <div key={category} className="category-group">
            <div className="category-header">{category}</div>
            {grouped[category].map((lang) => {
              return (
                <button
                  key={`${lang.displayName}:${lang.target}`}
                  className={`lang-row ${isSelected(lang) ? 'active' : ''}`}
                  onClick={() => handleSelect(lang)}
                  title={lang.displayName}
                >
                  <span className="lang-name">{lang.displayName}</span>
                  {lang.clients.length > 1 && <span className="client-name">{lang.clients.length} libs</span>}
                </button>
              );
            })}
          </div>
        ))}

        {orderedCategories.length === 0 && (
          <div className="no-results">No languages found</div>
        )}
      </div>
    </StyledWrapper>
  );
};

export default LanguageList;
