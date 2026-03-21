import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import FatigueGauge from '../components/FatigueGauge';

describe('FatigueGauge Component', () => {
  describe('🎨 Rendering', () => {
    it('should render gauge with default props', () => {
      const { container } = render(<FatigueGauge score={50} />);
      
      const gauge = container.querySelector('.fatigue-gauge');
      expect(gauge).toBeInTheDocument();
    });

    it('should display the score value', () => {
      render(<FatigueGauge score={75} />);
      
      const scoreText = screen.getByText('75');
      expect(scoreText).toBeInTheDocument();
    });

    it('should display the label', () => {
      render(<FatigueGauge score={50} label="Player Fatigue" />);
      
      expect(screen.getByText('Player Fatigue')).toBeInTheDocument();
    });

    it('should display status text based on score', () => {
      const { rerender } = render(<FatigueGauge score={25} />);
      expect(screen.getByText('Fresh')).toBeInTheDocument();

      rerender(<FatigueGauge score={45} />);
      expect(screen.getByText('Moderate')).toBeInTheDocument();

      rerender(<FatigueGauge score={70} />);
      expect(screen.getByText('Tired')).toBeInTheDocument();

      rerender(<FatigueGauge score={85} />);
      expect(screen.getByText('Exhausted')).toBeInTheDocument();
    });
  });

  describe('📊 Size Variants', () => {
    it('should render small size gauge', () => {
      const { container } = render(<FatigueGauge score={50} size="small" />);
      
      const gauge = container.querySelector('.fatigue-gauge--small');
      expect(gauge).toBeInTheDocument();
    });

    it('should render medium size gauge', () => {
      const { container } = render(<FatigueGauge score={50} size="medium" />);
      
      const gauge = container.querySelector('.fatigue-gauge--medium');
      expect(gauge).toBeInTheDocument();
    });

    it('should render large size gauge', () => {
      const { container } = render(<FatigueGauge score={50} size="large" />);
      
      const gauge = container.querySelector('.fatigue-gauge--large');
      expect(gauge).toBeInTheDocument();
    });
  });

  describe('🎯 Score Handling', () => {
    it('should clamp score to 0 when negative', () => {
      render(<FatigueGauge score={-10} />);
      
      const scoreText = screen.getByText('0');
      expect(scoreText).toBeInTheDocument();
    });

    it('should clamp score to 100 when exceeding', () => {
      render(<FatigueGauge score={150} />);
      
      const scoreText = screen.getByText('100');
      expect(scoreText).toBeInTheDocument();
    });

    it('should handle decimal scores', () => {
      render(<FatigueGauge score={50.7} />);
      
      // Component displays the rounded score in the SVG text
      expect(screen.getByText('50.7')).toBeInTheDocument();
    });

    it('should render with zero score', () => {
      render(<FatigueGauge score={0} />);
      
      expect(screen.getByText('0')).toBeInTheDocument();
      expect(screen.getByText('Fresh')).toBeInTheDocument();
    });

    it('should render with max score', () => {
      render(<FatigueGauge score={100} />);
      
      expect(screen.getByText('100')).toBeInTheDocument();
      expect(screen.getByText('Exhausted')).toBeInTheDocument();
    });
  });

  describe('🏷️ Label Visibility', () => {
    it('should show label when showLabel is true', () => {
      render(<FatigueGauge score={50} label="Test Label" showLabel={true} />);
      
      expect(screen.getByText('Test Label')).toBeInTheDocument();
    });

    it('should hide label when showLabel is false', () => {
      render(<FatigueGauge score={50} label="Test Label" showLabel={false} />);
      
      expect(screen.queryByText('Test Label')).not.toBeInTheDocument();
    });

    it('should display label by default', () => {
      render(<FatigueGauge score={50} label="Default Label" />);
      
      expect(screen.getByText('Default Label')).toBeInTheDocument();
    });
  });

  describe('🎨 Color Coding', () => {
    it('should apply fresh color for low score', () => {
      const { container } = render(<FatigueGauge score={25} />);
      
      const progressCircle = container.querySelector('.fatigue-gauge__progress');
      expect(progressCircle).toHaveAttribute('stroke', '#4CAF50');
    });

    it('should apply moderate color for medium-low score', () => {
      const { container } = render(<FatigueGauge score={45} />);
      
      const progressCircle = container.querySelector('.fatigue-gauge__progress');
      expect(progressCircle).toHaveAttribute('stroke', '#FFC107');
    });

    it('should apply tired color for high score', () => {
      const { container } = render(<FatigueGauge score={70} />);
      
      const progressCircle = container.querySelector('.fatigue-gauge__progress');
      expect(progressCircle).toHaveAttribute('stroke', '#FF9800');
    });

    it('should apply exhausted color for very high score', () => {
      const { container } = render(<FatigueGauge score={85} />);
      
      const progressCircle = container.querySelector('.fatigue-gauge__progress');
      expect(progressCircle).toHaveAttribute('stroke', '#F44336');
    });
  });

  describe('✅ Status Classes', () => {
    it('should apply fresh status class', () => {
      const { container } = render(<FatigueGauge score={25} />);
      
      const statusElement = container.querySelector('.fatigue-gauge__status--fresh');
      expect(statusElement).toBeInTheDocument();
    });

    it('should apply moderate status class', () => {
      const { container } = render(<FatigueGauge score={45} />);
      
      const statusElement = container.querySelector('.fatigue-gauge__status--moderate');
      expect(statusElement).toBeInTheDocument();
    });

    it('should apply tired status class', () => {
      const { container } = render(<FatigueGauge score={70} />);
      
      const statusElement = container.querySelector('.fatigue-gauge__status--tired');
      expect(statusElement).toBeInTheDocument();
    });

    it('should apply exhausted status class', () => {
      const { container } = render(<FatigueGauge score={85} />);
      
      const statusElement = container.querySelector('.fatigue-gauge__status--exhausted');
      expect(statusElement).toBeInTheDocument();
    });
  });

  describe('🔄 SVG Elements', () => {
    it('should render SVG element', () => {
      const { container } = render(<FatigueGauge score={50} />);
      
      const svg = container.querySelector('.fatigue-gauge__svg');
      expect(svg).toBeInTheDocument();
    });

    it('should have background and progress circles', () => {
      const { container } = render(<FatigueGauge score={50} />);
      
      const circles = container.querySelectorAll('circle');
      expect(circles.length).toBeGreaterThanOrEqual(2);
    });

    it('should have text elements for score display', () => {
      const { container } = render(<FatigueGauge score={50} />);
      
      const texts = container.querySelectorAll('text');
      expect(texts.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('📏 Gauge Dimensions', () => {
    it('small gauge should have correct dimensions', () => {
      const { container } = render(<FatigueGauge score={50} size="small" />);
      
      const svg = container.querySelector('.fatigue-gauge__svg');
      expect(svg).toHaveAttribute('width', '140');
      expect(svg).toHaveAttribute('height', '140');
    });

    it('medium gauge should have correct dimensions', () => {
      const { container } = render(<FatigueGauge score={50} size="medium" />);
      
      const svg = container.querySelector('.fatigue-gauge__svg');
      expect(svg).toHaveAttribute('width', '210');
      expect(svg).toHaveAttribute('height', '210');
    });

    it('large gauge should have correct dimensions', () => {
      const { container } = render(<FatigueGauge score={50} size="large" />);
      
      const svg = container.querySelector('.fatigue-gauge__svg');
      expect(svg).toHaveAttribute('width', '280');
      expect(svg).toHaveAttribute('height', '280');
    });
  });

  describe('🔢 Boundary Cases', () => {
    it('should handle score of exactly 30 (boundary)', () => {
      render(<FatigueGauge score={30} />);
      
      expect(screen.getByText('Moderate')).toBeInTheDocument();
    });

    it('should handle score of exactly 60 (boundary)', () => {
      render(<FatigueGauge score={60} />);
      
      expect(screen.getByText('Tired')).toBeInTheDocument();
    });

    it('should handle score of exactly 80 (boundary)', () => {
      render(<FatigueGauge score={80} />);
      
      expect(screen.getByText('Exhausted')).toBeInTheDocument();
    });
  });
});
