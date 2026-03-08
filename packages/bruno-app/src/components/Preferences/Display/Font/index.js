import React, { useState, useEffect, useCallback, useRef } from 'react';
import get from 'lodash/get';
import debounce from 'lodash/debounce';
import { useSelector, useDispatch } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { savePreferences } from 'providers/ReduxStore/slices/app';
import StyledWrapper from './StyledWrapper';
import toast from 'react-hot-toast';

const Font = () => {
  const dispatch = useDispatch();
  const { t } = useTranslation();
  const preferences = useSelector((state) => state.app.preferences);
  const isInitialMount = useRef(true);

  const [codeFont, setCodeFont] = useState(get(preferences, 'font.codeFont', 'default'));
  const [codeFontSize, setCodeFontSize] = useState(get(preferences, 'font.codeFontSize', '13'));

  const handleCodeFontChange = (event) => {
    setCodeFont(event.target.value);
  };

  const handleCodeFontSizeChange = (event) => {
    // Restrict to min/max value
    const clampedSize = Math.max(1, Math.min(event.target.value, 32));
    setCodeFontSize(clampedSize);
  };

  const handleSave = useCallback((font, fontSize) => {
    dispatch(
      savePreferences({
        ...preferences,
        font: {
          codeFont: font,
          codeFontSize: fontSize
        }
      })
    ).catch(() => {
      toast.error(t('PREFERENCES.SAVE_ERROR'));
    });
  }, [dispatch, preferences]);

  const debouncedSave = useCallback(
    debounce((font, fontSize) => {
      handleSave(font, fontSize);
    }, 500),
    [handleSave]
  );

  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }
    debouncedSave(codeFont, codeFontSize);
    return () => {
      debouncedSave.cancel();
    };
  }, [codeFont, codeFontSize, debouncedSave]);

  return (
    <StyledWrapper>
      <div className="flex flex-row gap-2 w-full">
        <div className="w-4/5">
          <label className="block">{t('PREFERENCES.DISPLAY.CODE_EDITOR_FONT')}</label>
          <input
            type="text"
            className="block textbox mt-2 w-full"
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck="false"
            onChange={handleCodeFontChange}
            defaultValue={codeFont}
          />
        </div>
        <div className="w-1/5">
          <label className="block">{t('PREFERENCES.DISPLAY.FONT_SIZE')}</label>
          <input
            type="number"
            className="block textbox mt-2 w-full"
            autoComplete="off"
            autoCorrect="off"
            inputMode="numeric"
            onChange={handleCodeFontSizeChange}
            defaultValue={codeFontSize}
          />
        </div>
      </div>
    </StyledWrapper>
  );
};

export default Font;
