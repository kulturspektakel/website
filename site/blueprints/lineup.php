<?php if(!defined('KIRBY')) exit ?>

title: Lineup
pages: band
files: false
fields:
  title:
    label: Title
    type:  text
  bookinginfo:
    label: Booking Information
    type:  textarea
  nocontent:
    label: Keine Band gefunden
    type:  textarea
  years:
    label: angezeigte Jahre (kommagetrennt)
    type: tags
