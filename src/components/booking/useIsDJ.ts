import {useParams} from '@tanstack/react-router';

export default function useIsDJ() {
  const {applicationType} = useParams({
    from: '/_main/booking_/$applicationType',
  });
  return applicationType === 'dj';
}
