import {useParams} from '@tanstack/react-router';

export default function useIsDJ() {
  const {applicationType} = useParams({
    from: '/booking_/$applicationType',
  });
  return applicationType === 'dj';
}
