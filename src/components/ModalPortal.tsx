import { createPortal } from 'react-dom';
import type { ReactNode } from 'react';

/**
 * 일반적인 .modal-backdrop/.modal-card는 부모 요소 어딘가에 transform·filter 같은 속성이
 * 있으면 position:fixed가 화면 기준이 아니라 그 부모 기준으로 깨질 수 있습니다(브라우저 표준 동작).
 * 그래서 이 컴포넌트는 document.body에 직접(Portal로) 렌더링해서, 부모 트리의 어떤 스타일과도
 * 무관하게 항상 화면 정중앙에, 잘리지 않고 뜨도록 만듭니다.
 */
export function ModalPortal({ onClose, children, wide }: { onClose: () => void; children: ReactNode; wide?: boolean }) {
  return createPortal(
    <div className="modal-backdrop" onClick={onClose}>
      <div className={`modal-card${wide ? ' wide' : ''}`} onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>,
    document.body,
  );
}
