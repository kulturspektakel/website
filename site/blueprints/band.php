<?php if(!defined('KIRBY')) exit ?>

title: Band
pages: false
files: true
fields:
  title:
    label: Bandname
    type: text
  day:
    label: Tag
    type: select
    options:
      Freitag: Freitag
      Samstag: Samstag
      Sonntag: Sonntag
    required: true
    width: 1/4
  time:
    label: Uhrzeit
    type: time
    required: true
    width: 1/4
  stage:
    label: Bühne
    type: select
    options:
      GB: Große Bühne
      KB: Kleine Bühne
      WB: Waldbühne
      A: Aula
      DJ: DJ-Eck
    required: true
    width: 1/2
  genre:
    label: Genre
    type:  text
  description:
    label: Beschreibung
    type:  textarea
  facebook:
    label: Facebook
    type: url
  soundcloud:
    label: Soundcloud
    type: url
  youtube:
    label: YouTube
    type: url
  website:
    label: Website
    type: url
  twitter:
    label: Twitter
    type: url
    