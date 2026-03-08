import { IconSearch, IconX } from '@tabler/icons';
import { useTranslation } from 'react-i18next';
import StyledWrapper from './StyledWrapper';

const CollectionSearch = ({ searchText, setSearchText }) => {
  const { t } = useTranslation();
  return (
    <StyledWrapper>
      <IconSearch size={14} strokeWidth={1.5} className="search-icon" />
      <input
        type="text"
        name="search"
        placeholder={t('COLLECTION_SEARCH.PLACEHOLDER')}
        id="search"
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        autoFocus
        spellCheck="false"
        value={searchText}
        onChange={(e) => setSearchText(e.target.value.toLowerCase())}
      />
      {searchText !== '' && (
        <div className="clear-icon" onClick={() => setSearchText('')}>
          <IconX size={14} strokeWidth={1.5} />
        </div>
      )}
    </StyledWrapper>
  );
};

export default CollectionSearch;
