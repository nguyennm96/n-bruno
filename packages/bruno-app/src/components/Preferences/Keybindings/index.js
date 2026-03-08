import StyledWrapper from './StyledWrapper';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { getKeyBindingsForOS } from 'providers/Hotkeys/keyMappings';
import { isMacOS } from 'utils/common/platform';

const Keybindings = ({ close }) => {
  const { t } = useTranslation();
  const keyMapping = getKeyBindingsForOS(isMacOS() ? 'mac' : 'windows');

  return (
    <StyledWrapper className="w-full">
      <div className="section-header">{t('PREFERENCES.KEYBINDINGS.TITLE')}</div>
      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>{t('PREFERENCES.KEYBINDINGS.COMMAND')}</th>
              <th>{t('PREFERENCES.KEYBINDINGS.KEYBINDING')}</th>
            </tr>
          </thead>
          <tbody>
            {keyMapping ? (
              Object.entries(keyMapping).map(([action, { name, keys }], index) => (
                <tr key={index}>
                  <td>{name}</td>
                  <td>
                    {keys.split('+').map((key, i) => (
                      <div className="key-button" key={i}>
                        {key}
                      </div>
                    ))}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="2">{t('PREFERENCES.KEYBINDINGS.NO_BINDINGS')}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </StyledWrapper>
  );
};

export default Keybindings;
