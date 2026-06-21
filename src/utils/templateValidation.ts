import { VARIABLE_REGISTRY } from '../components/VariableRegistry';

export interface ValidationError {
  id: string;
  type: 'error' | 'warning';
  elementId?: string;
  messageAr: string;
  messageEn: string;
}

export function validateTemplate(
  layout: any,
  paperWidth: number, // mm
  paperHeight: number, // mm
  margin: { top: number; bottom: number; left: number; right: number },
  dynamicFieldsKeys: string[] = []
): ValidationError[] {
  const errors: ValidationError[] = [];
  const printableWidth = paperWidth - margin.left - margin.right;
  const headerHeight = layout.headerHeight || 70;
  const footerHeight = layout.footerHeight || 50;

  const validVariableKeys = new Set(VARIABLE_REGISTRY.map(v => v.key));

  const validateElementList = (elements: any[], sectionName: 'header' | 'footer', maxSectionHeight: number) => {
    elements.forEach((el, idx) => {
      // 1. Boundary check: check if it falls outside printable width
      if (el.x + el.width > printableWidth) {
        errors.push({
          id: `boundary-x-${el.id}`,
          type: 'warning',
          elementId: el.id,
          messageAr: `العنصر يتجاوز العرض المطبوع للصفحة (${printableWidth} مم)`,
          messageEn: `Element exceeds the printable page width (${printableWidth} mm)`
        });
      }

      // 2. Section height check
      if (el.y + el.height > maxSectionHeight) {
        errors.push({
          id: `boundary-y-${el.id}`,
          type: 'error',
          elementId: el.id,
          messageAr: `العنصر يتجاوز ارتفاع قسم ${sectionName === 'header' ? 'الرأس' : 'التذييل'} المتاح (${maxSectionHeight} مم)`,
          messageEn: `Element exceeds the available ${sectionName} section height (${maxSectionHeight} mm)`
        });
      }

      // 3. Variable binding check
      if (el.type === 'variable' && el.binding && !validVariableKeys.has(el.binding)) {
        errors.push({
          id: `binding-var-${el.id}`,
          type: 'error',
          elementId: el.id,
          messageAr: `المتغير المحدد "${el.binding}" غير مسجل في النظام`,
          messageEn: `The variable "${el.binding}" is not registered in the system`
        });
      }

      // 4. Custom dynamic field check
      if (el.type === 'field' && el.binding && dynamicFieldsKeys.length > 0 && !dynamicFieldsKeys.includes(el.binding)) {
        errors.push({
          id: `binding-field-${el.id}`,
          type: 'warning',
          elementId: el.id,
          messageAr: `الحقل الديناميكي "${el.binding}" قد لا يكون متاحاً لكل العمليات`,
          messageEn: `The custom dynamic field "${el.binding}" may not be available for all operations`
        });
      }

      // 5. Blank image check
      if (el.type === 'image' && !el.properties?.imageUrl) {
        errors.push({
          id: `blank-img-${el.id}`,
          type: 'warning',
          elementId: el.id,
          messageAr: `لم يتم تحديد رابط الصورة المخصصة`,
          messageEn: `No image URL specified for custom image element`
        });
      }

      // 6. Element overlap check
      for (let j = idx + 1; j < elements.length; j++) {
        const other = elements[j];
        if (
          el.x < other.x + other.width &&
          el.x + el.width > other.x &&
          el.y < other.y + other.height &&
          el.y + el.height > other.y
        ) {
          // Overlap detected! Check if it's a minor overlap or non-transparent block
          if (!el.properties?.hidden && !other.properties?.hidden && el.type !== 'rectangle' && other.type !== 'rectangle') {
            errors.push({
              id: `overlap-${el.id}-${other.id}`,
              type: 'warning',
              elementId: el.id,
              messageAr: `تداخل محتمل بين عنصرين في قسم ${sectionName === 'header' ? 'الرأس' : 'التذييل'}`,
              messageEn: `Possible overlapping elements in the ${sectionName} section`
            });
          }
        }
      }
    });
  };

  // Run validation
  if (layout.header) {
    validateElementList(layout.header, 'header', headerHeight);
  }
  if (layout.footer) {
    validateElementList(layout.footer, 'footer', footerHeight);
  }

  // Validate details table columns
  if (layout.details?.columns) {
    const totalWidth = layout.details.columns.reduce((sum: number, c: any) => sum + (Number(c.width) || 0), 0);
    if (Math.abs(totalWidth - 100) > 5) {
      errors.push({
        id: 'table-width',
        type: 'warning',
        messageAr: `مجموع نسب عرض أعمدة الجدول (${totalWidth}%) لا يساوي 100% تقريباً`,
        messageEn: `Sum of table column widths (${totalWidth}%) is not close to 100%`
      });
    }
  }

  return errors;
}

export function evaluateCondition(cond: any, data: any): boolean {
  if (!cond || !cond.enabled) return true;
  const actualVal = data[cond.field] ?? data.dynamicFields?.[cond.field] ?? '';
  const stringVal = String(actualVal ?? '').trim();
  const compareVal = String(cond.value ?? '').trim();

  switch (cond.operator) {
    case 'is_empty':
      return stringVal === '';
    case 'is_not_empty':
      return stringVal !== '';
    case 'equals':
      return stringVal === compareVal;
    case 'not_equals':
      return stringVal !== compareVal;
    case 'greater_than':
      return Number(stringVal) > Number(compareVal);
    case 'less_than':
      return Number(stringVal) < Number(compareVal);
    case 'contains':
      return stringVal.toLowerCase().includes(compareVal.toLowerCase());
    default:
      return true;
  }
}
