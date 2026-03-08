import React from 'react';
import { useTranslation } from 'react-i18next';
import StyledWrapper from './StyledWrapper';

const ResponseHeaders = ({ headers }) => {
  const { t } = useTranslation();
  const headersArray = typeof headers === 'object' ? Object.entries(headers) : [];

  return (
    <StyledWrapper className="pb-4 w-full">
      <div className="table-wrapper">
        <table>
          <thead>
            <tr>
              <td>{t('COMMON.NAME')}</td>
              <td>{t('COMMON.VALUE')}</td>
            </tr>
          </thead>
          <tbody>
            {headersArray && headersArray.length
              ? headersArray.map((header, index) => {
                  return (
                    <tr key={index}>
                      <td className="key">{header[0]}</td>
                      <td className="value">{header[1]}</td>
                    </tr>
                  );
                })
              : null}
          </tbody>
        </table>
      </div>
    </StyledWrapper>
  );
};
export default ResponseHeaders;
