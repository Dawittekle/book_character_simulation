import './CharacterInsights.css';
import { formatMetricLabel, getEmotionColor } from '../lib/formatters';

function CharacterInsights({ emotionState, psiParameters }) {
  if (!emotionState && !psiParameters) {
    return null;
  }

  return (
    <div className="insight-sections">
      {emotionState ? (
        <section className="insight-panel surface-card">
          <span className="section-eyebrow">Emotion state</span>
          <div className="insight-meters">
            {Object.entries(emotionState).map(([emotion, value]) => (
              <label key={emotion} className="insight-meter">
                <span className="insight-meter-topline">
                  <strong>{formatMetricLabel(emotion)}</strong>
                  <small>{Math.round(value * 100)}%</small>
                </span>
                <span className="insight-meter-track">
                  <span
                    className="insight-meter-fill"
                    style={{
                      width: `${value * 100}%`,
                      backgroundColor: getEmotionColor(emotion),
                    }}
                  />
                </span>
              </label>
            ))}
          </div>
        </section>
      ) : null}

      {psiParameters ? (
        <section className="insight-panel surface-card">
          <span className="section-eyebrow">Psychological parameters</span>
          <div className="insight-meters">
            {Object.entries(psiParameters).map(([parameter, value]) => (
              <label key={parameter} className="insight-meter">
                <span className="insight-meter-topline">
                  <strong>{formatMetricLabel(parameter)}</strong>
                  <small>{Math.round(value * 100)}%</small>
                </span>
                <span className="insight-meter-track">
                  <span
                    className="insight-meter-fill is-psi"
                    style={{
                      width: `${value * 100}%`,
                    }}
                  />
                </span>
              </label>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}

export default CharacterInsights;
