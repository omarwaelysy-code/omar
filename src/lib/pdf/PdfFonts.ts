import { Font } from '@react-pdf/renderer';

export const registerPdfFonts = () => {
  Font.register({
    family: 'Noto Sans Arabic',
    fonts: [
      { src: '/fonts/NotoSansArabic-Regular.ttf', fontWeight: 'normal' },
      { src: '/fonts/NotoSansArabic-Bold.ttf', fontWeight: 'bold' }
    ]
  });
};
