"use client";

/**
 * Vùng 5 - Tốc độ gửi (giây).
 * Props:
 *  - speedMin, speedMax: number
 *  - onChange: (next: { speedMin, speedMax }) => void
 */
export default function SpeedControl({ speedMin, speedMax, onChange }) {
  const invalid = speedMax < speedMin;

  return (
    <section className="panel">
      <h2 className="panel-title">
        <span className="panel-number">5</span>
        Tốc độ gửi tin (giây)
      </h2>

      <div className="speed-row">
        <label className="speed-field">
          <span>Từ</span>
          <input
            type="number"
            min={0}
            step={0.5}
            className="number-input"
            value={speedMin}
            onChange={(e) => onChange({ speedMin: Number(e.target.value), speedMax })}
          />
          <span>giây</span>
        </label>

        <label className="speed-field">
          <span>Đến</span>
          <input
            type="number"
            min={0}
            step={0.5}
            className="number-input"
            value={speedMax}
            onChange={(e) => onChange({ speedMin, speedMax: Number(e.target.value) })}
          />
          <span>giây</span>
        </label>
      </div>

      {invalid && (
        <p className="field-error">Tốc độ tối đa phải lớn hơn hoặc bằng tốc độ tối thiểu.</p>
      )}
    </section>
  );
}
