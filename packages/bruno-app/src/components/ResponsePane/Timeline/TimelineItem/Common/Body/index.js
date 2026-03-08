import QueryResponse from 'components/ResponsePane/QueryResponse/index';
import { useTranslation } from 'react-i18next';
import { useState } from 'react';

const BodyBlock = ({ collection, data, dataBuffer, headers, error, item, type }) => {
  const { t } = useTranslation();
  const [isBodyCollapsed, toggleBody] = useState(true);
  return (
    <div className="collapsible-section">
      <div className="section-header" onClick={() => toggleBody(!isBodyCollapsed)}>
        <pre className="flex flex-row items-center">
          <div className="opacity-70">{isBodyCollapsed ? '▼' : '▶'}</div> {t('RESPONSE_PANE.TIMELINE.BODY_SECTION')}
        </pre>
      </div>
      {isBodyCollapsed && (
        <div className="mt-2">
          {data || dataBuffer ? (
            <div className="h-96 overflow-auto">
              <QueryResponse
                item={item}
                collection={collection}
                data={data}
                dataBuffer={dataBuffer}
                headers={headers}
                error={error}
                key={item?.uid}
                hideResultTypeSelector={type === 'request'}
              />
            </div>
          ) : (
            <div className="timeline-item-timestamp">{t('RESPONSE_PANE.TIMELINE.NO_BODY')}</div>
          )}
        </div>
      )}
    </div>
  );
};

export default BodyBlock;
