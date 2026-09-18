import { useThree } from '@react-three/fiber/native';
import { useEffect } from 'react';
import * as THREE from 'three';
import { fitCamera } from './cameraFit';

/**
 * Keeps the camera framed to the arena for the current viewport size.
 * Re-fits on mount and on any canvas resize (rotation, split view, etc.).
 */
export function CameraRig() {
  const camera = useThree((state) => state.camera);
  const size = useThree((state) => state.size);

  useEffect(() => {
    if (size.width > 0 && size.height > 0) {
      fitCamera(camera as THREE.PerspectiveCamera, size.width / size.height);
    }
  }, [camera, size.width, size.height]);

  return null;
}
